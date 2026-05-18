package com.cwoc.app.data.mapper

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.core.content.FileProvider
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/**
 * Handles contact profile image operations: resize, camera file creation, GIF detection.
 * Matches the web's Image_Manager behavior (max 512px, GIF passthrough).
 */
object ContactImageManager {

    /** Maximum dimension (width or height) for resized images */
    private const val MAX_IMAGE_SIZE = 512

    /** JPEG compression quality (0-100) */
    private const val JPEG_QUALITY = 85

    /**
     * Check if a URI points to a GIF image.
     */
    fun isGif(context: Context, uri: Uri): Boolean {
        val mimeType = context.contentResolver.getType(uri)
        return mimeType == "image/gif"
    }

    /**
     * Resize an image from a URI to max [MAX_IMAGE_SIZE] pixels on the longest side.
     * GIFs are copied as-is without processing (to preserve animation).
     * Returns a temporary File containing the processed image.
     */
    fun resizeImage(context: Context, uri: Uri, maxSize: Int = MAX_IMAGE_SIZE): File? {
        return try {
            val inputStream = context.contentResolver.openInputStream(uri) ?: return null

            // GIF passthrough — copy without resize
            if (isGif(context, uri)) {
                val bytes = inputStream.readBytes()
                inputStream.close()
                val tempFile = File.createTempFile("contact_img_", ".gif", context.cacheDir)
                tempFile.writeBytes(bytes)
                return tempFile
            }

            val bytes = inputStream.readBytes()
            inputStream.close()

            // Decode bitmap
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)

            // Calculate sample size for memory efficiency
            val origWidth = options.outWidth
            val origHeight = options.outHeight
            var sampleSize = 1
            while (origWidth / sampleSize > maxSize * 2 || origHeight / sampleSize > maxSize * 2) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decodeOptions) ?: return null

            // Scale to max dimension
            val w = bitmap.width
            val h = bitmap.height
            val scaledBitmap = if (w > maxSize || h > maxSize) {
                val scale = maxSize.toFloat() / maxOf(w, h)
                val newW = (w * scale).toInt()
                val newH = (h * scale).toInt()
                Bitmap.createScaledBitmap(bitmap, newW, newH, true)
            } else {
                bitmap
            }

            // Compress to JPEG
            val tempFile = File.createTempFile("contact_img_", ".jpg", context.cacheDir)
            FileOutputStream(tempFile).use { fos ->
                scaledBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, fos)
            }

            // Clean up
            if (scaledBitmap !== bitmap) scaledBitmap.recycle()
            bitmap.recycle()

            tempFile
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Resize a Bitmap (from camera capture) to max size and save to temp file.
     */
    fun resizeBitmap(context: Context, bitmap: Bitmap, maxSize: Int = MAX_IMAGE_SIZE): File? {
        return try {
            val w = bitmap.width
            val h = bitmap.height
            val scaledBitmap = if (w > maxSize || h > maxSize) {
                val scale = maxSize.toFloat() / maxOf(w, h)
                val newW = (w * scale).toInt()
                val newH = (h * scale).toInt()
                Bitmap.createScaledBitmap(bitmap, newW, newH, true)
            } else {
                bitmap
            }

            val tempFile = File.createTempFile("contact_img_", ".jpg", context.cacheDir)
            FileOutputStream(tempFile).use { fos ->
                scaledBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, fos)
            }

            if (scaledBitmap !== bitmap) scaledBitmap.recycle()
            tempFile
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Create a temporary file and FileProvider URI for camera capture.
     * Returns Pair(file, uri) or null on failure.
     */
    fun createTempCameraFile(context: Context): Pair<File, Uri>? {
        return try {
            val tempFile = File.createTempFile("camera_capture_", ".jpg", context.cacheDir)
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                tempFile
            )
            Pair(tempFile, uri)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Convert a File to bytes for multipart upload.
     */
    fun fileToBytes(file: File): ByteArray = file.readBytes()

    /**
     * Get the MIME type for a file based on extension.
     */
    fun getMimeType(file: File): String {
        return when (file.extension.lowercase()) {
            "gif" -> "image/gif"
            "png" -> "image/png"
            "webp" -> "image/webp"
            else -> "image/jpeg"
        }
    }
}
