package com.cwoc.app.util

import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.widget.Toast
import androidx.core.content.FileProvider
import com.cwoc.app.ui.screens.editor.zones.AttachmentInfo
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream

/**
 * Helper for printing attachments from chits.
 *
 * Supports:
 * - Images (via PrintHelper bitmap printing)
 * - PDFs (via PrintDocumentAdapter)
 * - Text files (via share intent to print service)
 * - Other types (share intent as fallback)
 */
object PrintAttachmentHelper {

    /**
     * Parse attachments JSON string into a list of AttachmentInfo objects.
     */
    fun parseAttachments(json: String?): List<AttachmentInfo> {
        if (json.isNullOrBlank()) return emptyList()
        return try {
            Gson().fromJson(json, object : TypeToken<List<AttachmentInfo>>() {}.type)
        } catch (_: Exception) {
            emptyList()
        }
    }

    /**
     * Download an attachment to cache and print it.
     * Must be called from a coroutine scope.
     */
    suspend fun downloadAndPrint(
        context: Context,
        attachment: AttachmentInfo,
        chitId: String,
        serverUrl: String,
        authToken: String,
        httpClient: OkHttpClient? = null
    ) {
        withContext(Dispatchers.Main) {
            Toast.makeText(context, "Preparing to print ${attachment.filename}…", Toast.LENGTH_SHORT).show()
        }

        val client = httpClient ?: OkHttpClient()

        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("$serverUrl/api/chits/$chitId/attachments/${attachment.id}")
                    .addHeader("Authorization", "Bearer $authToken")
                    .get()
                    .build()

                val response = client.newCall(request).execute()
                if (!response.isSuccessful) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(context, "Download failed (HTTP ${response.code})", Toast.LENGTH_SHORT).show()
                    }
                    return@withContext
                }

                val bytes = response.body?.bytes() ?: return@withContext

                // Write to cache directory
                val cacheDir = File(context.cacheDir, "attachments")
                cacheDir.mkdirs()
                val file = File(cacheDir, "print_${attachment.filename}")
                file.writeBytes(bytes)

                val mimeType = attachment.mimeType ?: "application/octet-stream"

                withContext(Dispatchers.Main) {
                    when {
                        mimeType.startsWith("image/") -> printImage(context, file, attachment.filename)
                        mimeType == "application/pdf" -> printPdf(context, file, attachment.filename)
                        else -> printViaShareIntent(context, file, mimeType, attachment.filename)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "Print failed: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /**
     * Print an image file using Android's PrintManager.
     */
    private fun printImage(context: Context, file: File, jobName: String) {
        try {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            if (bitmap == null) {
                Toast.makeText(context, "Could not decode image for printing.", Toast.LENGTH_SHORT).show()
                return
            }
            val adapter = object : PrintDocumentAdapter() {
                override fun onLayout(
                    oldAttributes: PrintAttributes?,
                    newAttributes: PrintAttributes?,
                    cancellationSignal: CancellationSignal?,
                    callback: LayoutResultCallback?,
                    extras: Bundle?
                ) {
                    if (cancellationSignal?.isCanceled == true) {
                        callback?.onLayoutCancelled()
                        return
                    }
                    val info = PrintDocumentInfo.Builder(jobName)
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_PHOTO)
                        .setPageCount(1)
                        .build()
                    callback?.onLayoutFinished(info, true)
                }

                override fun onWrite(
                    pages: Array<out PageRange>?,
                    destination: ParcelFileDescriptor?,
                    cancellationSignal: CancellationSignal?,
                    callback: WriteResultCallback?
                ) {
                    if (cancellationSignal?.isCanceled == true) {
                        callback?.onWriteCancelled()
                        return
                    }
                    try {
                        // Convert bitmap to PDF page for printing
                        val pdfDocument = android.graphics.pdf.PdfDocument()
                        val pageInfo = android.graphics.pdf.PdfDocument.PageInfo.Builder(
                            bitmap.width, bitmap.height, 1
                        ).create()
                        val page = pdfDocument.startPage(pageInfo)
                        page.canvas.drawBitmap(bitmap, 0f, 0f, null)
                        pdfDocument.finishPage(page)
                        FileOutputStream(destination?.fileDescriptor).use { output ->
                            pdfDocument.writeTo(output)
                        }
                        pdfDocument.close()
                        callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                    } catch (e: Exception) {
                        callback?.onWriteFailed(e.message)
                    }
                }
            }
            printManager.print("CWOC - $jobName", adapter, null)
        } catch (e: Exception) {
            // Fallback: use share intent
            printViaShareIntent(context, file, "image/*", jobName)
        }
    }

    /**
     * Print a PDF file using Android's PrintManager with a custom PrintDocumentAdapter.
     */
    private fun printPdf(context: Context, file: File, jobName: String) {
        try {
            val printManager = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val adapter = object : PrintDocumentAdapter() {
                override fun onLayout(
                    oldAttributes: PrintAttributes?,
                    newAttributes: PrintAttributes?,
                    cancellationSignal: CancellationSignal?,
                    callback: LayoutResultCallback?,
                    extras: Bundle?
                ) {
                    if (cancellationSignal?.isCanceled == true) {
                        callback?.onLayoutCancelled()
                        return
                    }
                    val info = PrintDocumentInfo.Builder(jobName)
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                        .build()
                    callback?.onLayoutFinished(info, true)
                }

                override fun onWrite(
                    pages: Array<out PageRange>?,
                    destination: ParcelFileDescriptor?,
                    cancellationSignal: CancellationSignal?,
                    callback: WriteResultCallback?
                ) {
                    if (cancellationSignal?.isCanceled == true) {
                        callback?.onWriteCancelled()
                        return
                    }
                    try {
                        file.inputStream().use { input ->
                            FileOutputStream(destination?.fileDescriptor).use { output ->
                                input.copyTo(output)
                            }
                        }
                        callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
                    } catch (e: Exception) {
                        callback?.onWriteFailed(e.message)
                    }
                }
            }
            printManager.print("CWOC - $jobName", adapter, null)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not print PDF: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Fallback: share the file via an intent that can reach print services.
     */
    private fun printViaShareIntent(context: Context, file: File, mimeType: String, jobName: String) {
        try {
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                putExtra(Intent.EXTRA_STREAM, uri)
                type = mimeType
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val chooser = Intent.createChooser(intent, "Print: $jobName")
            context.startActivity(chooser)
        } catch (e: Exception) {
            Toast.makeText(context, "No app available to print this file type.", Toast.LENGTH_SHORT).show()
        }
    }
}
