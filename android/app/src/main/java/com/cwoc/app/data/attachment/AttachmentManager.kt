package com.cwoc.app.data.attachment

import com.cwoc.app.data.local.dao.AttachmentMetadataDao
import com.cwoc.app.data.local.entity.AttachmentMetadata
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.data.sync.ConnectivityMonitor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Represents the current state of an attachment download operation.
 */
sealed class DownloadState {
    /** No download in progress or attempted. */
    object Idle : DownloadState()

    /** Download is in progress with a progress fraction (0.0 to 1.0). */
    data class Downloading(val progress: Float) : DownloadState()

    /** Download completed successfully. */
    data class Complete(val file: File) : DownloadState()

    /** Download failed with an error message. */
    data class Error(val message: String) : DownloadState()
}

/**
 * Interface for managing attachment downloads, uploads, and cache orchestration.
 *
 * - Downloads are lazy: files are fetched from the server only on first access.
 * - Uploads are eager: files are uploaded immediately when online, queued when offline.
 * - Cache is checked before any download to avoid redundant network calls.
 */
interface AttachmentManager {

    /**
     * Downloads an attachment by ID. Checks cache first; if cached, returns immediately.
     * If not cached, downloads from the server with progress tracking and stores in cache.
     *
     * @param attachmentId The unique ID of the attachment metadata record.
     * @param url The server URL to download from if not cached.
     * @return Result containing the local File on success, or an error on failure.
     */
    suspend fun downloadAttachment(attachmentId: String, url: String): Result<File>

    /**
     * Uploads an attachment for a chit. Stores locally in cache immediately.
     * If online, uploads to the server right away. If offline, queues for later upload.
     *
     * @param chitId The chit this attachment belongs to.
     * @param filename The original filename of the attachment.
     * @param mimeType The MIME type of the file content.
     * @param data The raw file bytes.
     * @return Result containing the attachment ID on success.
     */
    suspend fun uploadAttachment(
        chitId: String,
        filename: String,
        mimeType: String,
        data: ByteArray
    ): Result<String>

    /**
     * Uploads all pending attachments that were queued while offline.
     * Called when connectivity is restored.
     */
    suspend fun uploadPendingAttachments()

    /**
     * Returns the cached file for an attachment, or null if not cached.
     *
     * @param attachmentId The unique ID of the attachment.
     */
    suspend fun getCachedFile(attachmentId: String): File?

    /**
     * Returns a StateFlow representing the current download state for an attachment.
     * Callers can collect this to show progress indicators in the UI.
     *
     * @param attachmentId The unique ID of the attachment.
     */
    fun getDownloadState(attachmentId: String): StateFlow<DownloadState>
}

/**
 * Implementation of [AttachmentManager] that orchestrates downloads, uploads,
 * and cache interactions using [AttachmentCache], [AttachmentMetadataDao],
 * [CwocApiService], and [ConnectivityMonitor].
 */
@Singleton
class AttachmentManagerImpl @Inject constructor(
    private val attachmentCache: AttachmentCache,
    private val attachmentMetadataDao: AttachmentMetadataDao,
    private val apiService: CwocApiService,
    private val connectivityMonitor: ConnectivityMonitor
) : AttachmentManager {

    /**
     * Tracks download state per attachment ID. Each entry is a MutableStateFlow
     * that the UI can observe for progress updates.
     */
    private val downloadStates = ConcurrentHashMap<String, MutableStateFlow<DownloadState>>()

    override suspend fun downloadAttachment(attachmentId: String, url: String): Result<File> {
        val stateFlow = getOrCreateStateFlow(attachmentId)

        // Check cache first — if hit, return immediately
        val cachedFile = attachmentCache.get(attachmentId)
        if (cachedFile != null) {
            stateFlow.value = DownloadState.Complete(cachedFile)
            return Result.success(cachedFile)
        }

        // Not cached — download from server
        stateFlow.value = DownloadState.Downloading(0f)

        return try {
            val response = apiService.downloadAttachment(attachmentId)

            if (!response.isSuccessful) {
                val errorMsg = "Download failed: HTTP ${response.code()}"
                stateFlow.value = DownloadState.Error(errorMsg)
                return Result.failure(Exception(errorMsg))
            }

            val body = response.body()
            if (body == null) {
                val errorMsg = "Download failed: empty response body"
                stateFlow.value = DownloadState.Error(errorMsg)
                return Result.failure(Exception(errorMsg))
            }

            // Read the response body with progress tracking
            val contentLength = body.contentLength()
            val bytes = if (contentLength > 0) {
                val inputStream = body.byteStream()
                val buffer = ByteArray(8192)
                val outputStream = ByteArrayOutputStream()
                var bytesRead: Int
                var totalRead = 0L

                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                    totalRead += bytesRead
                    val progress = (totalRead.toFloat() / contentLength).coerceIn(0f, 1f)
                    stateFlow.value = DownloadState.Downloading(progress)
                }
                inputStream.close()
                outputStream.toByteArray()
            } else {
                // Content length unknown — read all at once
                stateFlow.value = DownloadState.Downloading(0.5f)
                body.bytes()
            }

            // Store in cache
            attachmentCache.put(attachmentId, bytes)

            // Get the file back from cache to return
            val file = attachmentCache.get(attachmentId)
            if (file != null) {
                stateFlow.value = DownloadState.Complete(file)
                Result.success(file)
            } else {
                val errorMsg = "Failed to retrieve file from cache after storing"
                stateFlow.value = DownloadState.Error(errorMsg)
                Result.failure(Exception(errorMsg))
            }
        } catch (e: Exception) {
            val errorMsg = e.message ?: "Download failed: unknown error"
            stateFlow.value = DownloadState.Error(errorMsg)
            Result.failure(e)
        }
    }

    override suspend fun uploadAttachment(
        chitId: String,
        filename: String,
        mimeType: String,
        data: ByteArray
    ): Result<String> {
        val attachmentId = UUID.randomUUID().toString()
        val now = Instant.now().toString()

        // Create metadata record with pendingUpload=true
        val metadata = AttachmentMetadata(
            id = attachmentId,
            chitId = chitId,
            url = null,
            filename = filename,
            sizeBytes = data.size.toLong(),
            mimeType = mimeType,
            localPath = null,
            pendingUpload = true,
            lastAccessedAt = now,
            createdAt = now
        )
        attachmentMetadataDao.insert(metadata)

        // Store in local cache immediately
        attachmentCache.put(attachmentId, data)

        // If online, upload immediately
        if (connectivityMonitor.isOnline.value) {
            val uploadResult = performUpload(attachmentId, chitId, filename, mimeType, data)
            if (uploadResult.isSuccess) {
                return Result.success(attachmentId)
            }
            // Upload failed but file is stored locally with pendingUpload=true
            // It will be retried on connectivity restore
        }

        // If offline or upload failed, the attachment is queued (pendingUpload=true)
        return Result.success(attachmentId)
    }

    override suspend fun uploadPendingAttachments() {
        val pendingUploads = attachmentMetadataDao.getPendingUploads()

        for (metadata in pendingUploads) {
            // Get the cached file data
            val file = attachmentCache.get(metadata.id) ?: continue

            val data = file.readBytes()
            performUpload(
                attachmentId = metadata.id,
                chitId = metadata.chitId,
                filename = metadata.filename,
                mimeType = metadata.mimeType ?: "application/octet-stream",
                data = data
            )
        }
    }

    override suspend fun getCachedFile(attachmentId: String): File? {
        return attachmentCache.get(attachmentId)
    }

    override fun getDownloadState(attachmentId: String): StateFlow<DownloadState> {
        return getOrCreateStateFlow(attachmentId).asStateFlow()
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────────

    /**
     * Gets or creates a MutableStateFlow for tracking download state of an attachment.
     */
    private fun getOrCreateStateFlow(attachmentId: String): MutableStateFlow<DownloadState> {
        return downloadStates.getOrPut(attachmentId) {
            MutableStateFlow(DownloadState.Idle)
        }
    }

    /**
     * Performs the actual multipart upload to the server.
     * On success, updates the metadata record with the server-assigned URL
     * and clears the pendingUpload flag.
     */
    private suspend fun performUpload(
        attachmentId: String,
        chitId: String,
        filename: String,
        mimeType: String,
        data: ByteArray
    ): Result<String> {
        return try {
            val chitIdBody = chitId.toRequestBody("text/plain".toMediaType())
            val filenameBody = filename.toRequestBody("text/plain".toMediaType())
            val mimeTypeBody = mimeType.toRequestBody("text/plain".toMediaType())

            val fileRequestBody = data.toRequestBody(mimeType.toMediaType())
            val filePart = MultipartBody.Part.createFormData("file", filename, fileRequestBody)

            val response = apiService.uploadAttachment(
                chitId = chitIdBody,
                filename = filenameBody,
                mimeType = mimeTypeBody,
                file = filePart
            )

            if (response.isSuccessful) {
                val uploadResponse = response.body()
                if (uploadResponse != null) {
                    // Update metadata: set URL and clear pendingUpload flag
                    attachmentMetadataDao.updateAfterUpload(attachmentId, uploadResponse.url)
                    Result.success(uploadResponse.url)
                } else {
                    Result.failure(Exception("Upload succeeded but response body was empty"))
                }
            } else {
                Result.failure(Exception("Upload failed: HTTP ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
