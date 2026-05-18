package com.cwoc.app.ui.components

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/**
 * Dialog that generates and displays a QR code from a contact's vCard string.
 *
 * Features:
 * - QR code image generated via ZXing
 * - Share button (shares the QR code image)
 * - Copy vCard button (copies vCard text to clipboard)
 *
 * Accessible from contact editor overflow menu → "Share QR Code".
 *
 * @param vCardString The vCard string to encode as a QR code
 * @param contactName The contact's display name (for dialog title)
 * @param onDismiss Callback when the dialog is dismissed
 */
@Composable
fun QrCodeDialog(
    vCardString: String,
    contactName: String,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current

    // Generate QR code bitmap
    val qrBitmap = remember(vCardString) {
        generateQrCode(vCardString, 512)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("QR Code — $contactName") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // QR Code image
                if (qrBitmap != null) {
                    Image(
                        bitmap = qrBitmap.asImageBitmap(),
                        contentDescription = "QR Code for $contactName",
                        modifier = Modifier.size(256.dp)
                    )
                } else {
                    Text(
                        text = "Failed to generate QR code",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Action buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Share button
                    OutlinedButton(
                        onClick = {
                            shareVCard(context, vCardString, contactName)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.Share, null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Share")
                    }

                    // Copy vCard button
                    OutlinedButton(
                        onClick = {
                            copyToClipboard(context, vCardString)
                        },
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(Icons.Default.ContentCopy, null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Copy")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    )
}

/**
 * Generates a QR code bitmap from the given text using ZXing.
 *
 * @param text The text to encode
 * @param size The width/height of the QR code in pixels
 * @return A Bitmap containing the QR code, or null if generation fails
 */
private fun generateQrCode(text: String, size: Int): Bitmap? {
    return try {
        val hints = mapOf(
            EncodeHintType.CHARACTER_SET to "UTF-8",
            EncodeHintType.MARGIN to 1
        )
        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(text, BarcodeFormat.QR_CODE, size, size, hints)

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(
                    x, y,
                    if (bitMatrix.get(x, y)) android.graphics.Color.BLACK
                    else android.graphics.Color.WHITE
                )
            }
        }
        bitmap
    } catch (_: Exception) {
        null
    }
}

/**
 * Shares the vCard string via Android share intent.
 */
private fun shareVCard(context: Context, vCardString: String, contactName: String) {
    val shareIntent = Intent(Intent.ACTION_SEND).apply {
        type = "text/vcard"
        putExtra(Intent.EXTRA_TEXT, vCardString)
        putExtra(Intent.EXTRA_SUBJECT, "$contactName.vcf")
    }
    context.startActivity(Intent.createChooser(shareIntent, "Share Contact"))
}

/**
 * Copies text to the system clipboard.
 */
private fun copyToClipboard(context: Context, text: String) {
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val clip = ClipData.newPlainText("vCard", text)
    clipboard.setPrimaryClip(clip)
}
