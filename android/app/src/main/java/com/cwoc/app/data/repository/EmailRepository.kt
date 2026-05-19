package com.cwoc.app.data.repository

import com.cwoc.app.data.remote.EmailBackfillEstimateResponse
import com.cwoc.app.data.remote.EmailSendResponse
import com.cwoc.app.data.remote.EmailSyncResponse
import com.cwoc.app.data.remote.EmailTestConnectionResponse

/**
 * Repository interface for email-specific operations.
 *
 * Handles email sync, send, schedule, archive-original, mark-read, backfill,
 * test-connection, PGP key retrieval, and raw EML download.
 *
 * Delegates chit CRUD (pin, archive, delete, update) to the existing [ChitRepository].
 *
 * Validates: Requirements 32.2, 44.3, 45.3, 46.4, 47.3, 49.3, 53.2, 60.2, 65.2, 65.4
 */
interface EmailRepository {

    /**
     * Trigger email sync across all configured IMAP accounts.
     * @param backfill If true, pulls all historical messages (full backfill).
     * @return Result with sync response containing new/deleted counts, or error.
     */
    suspend fun syncEmail(backfill: Boolean = false): Result<EmailSyncResponse>

    /**
     * Send an email draft via the server.
     * The server handles SMTP delivery and moves the chit to Sent folder.
     * @param chitId The ID of the draft chit to send.
     * @return Result with send response containing status/message, or error.
     */
    suspend fun sendEmail(chitId: String): Result<EmailSendResponse>

    /**
     * Schedule an email for later delivery.
     * @param chitId The ID of the draft chit to schedule.
     * @param sendAt ISO datetime string for when to send.
     * @return Result indicating success or failure.
     */
    suspend fun scheduleEmail(chitId: String, sendAt: String): Result<Unit>

    /**
     * Cancel a previously scheduled email send.
     * @param chitId The ID of the scheduled chit to cancel.
     * @return Result indicating success or failure.
     */
    suspend fun cancelSchedule(chitId: String): Result<Unit>

    /**
     * Archive the original email after sending a reply.
     * @param inReplyToMessageId The Message-ID of the original email to archive.
     * @return Result indicating success or failure.
     */
    suspend fun archiveOriginal(inReplyToMessageId: String): Result<Unit>

    /**
     * Mark an email as read or unread on the server.
     * @param chitId The ID of the email chit.
     * @param read True to mark as read, false to mark as unread.
     * @return Result indicating success or failure.
     */
    suspend fun markRead(chitId: String, read: Boolean): Result<Unit>

    /**
     * Estimate mailbox size for backfill (message count and storage).
     * @return Result with backfill estimate response, or error.
     */
    suspend fun backfillEstimate(): Result<EmailBackfillEstimateResponse>

    /**
     * Test email IMAP/SMTP connectivity with provided credentials.
     * @param config Map of connection parameters (host, port, username, password, etc.).
     * @return Result with test connection response showing IMAP/SMTP results.
     */
    suspend fun testConnection(config: Map<String, Any?>): Result<EmailTestConnectionResponse>

    /**
     * Retrieve the user's private PGP key (requires password confirmation).
     * @param password The user's password for key decryption.
     * @return Result with the private key string, or error.
     */
    suspend fun getPrivatePgpKey(password: String): Result<String>

    /**
     * Download the raw .eml file for an email.
     * @param chitId The ID of the email chit.
     * @return Result with the raw EML bytes, or error.
     */
    suspend fun downloadRawEml(chitId: String): Result<ByteArray>

    /**
     * Add a classification rule to a bundle so future matching emails are auto-classified.
     * Calls POST /api/bundles/{bundleId}/add-rule with match_type and match_value.
     * @param bundleId The ID of the target bundle.
     * @param matchType "sender" or "subject".
     * @param matchValue The sender email or subject text to match.
     * @return Result indicating success or failure.
     */
    suspend fun addRuleToBundle(bundleId: String, matchType: String, matchValue: String): Result<Unit>
}
