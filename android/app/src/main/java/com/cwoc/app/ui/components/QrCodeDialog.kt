package com.cwoc.app.ui.components

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.ContactEntity
import com.cwoc.app.data.mapper.VCardBuilder
import com.cwoc.app.ui.theme.CwocParchment
import com.cwoc.app.ui.theme.CwocZoneHeaderBrown
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import org.json.JSONObject

/**
 * Dialog that displays a QR code containing a contact's vCard data.
 * Matches the web's showContactQrCode() behavior.
 */
@Composable
fun ContactQrCodeDialog(
    contact: ContactEntity,
    onDismiss: () -> Unit
) {
    val displayName = contact.displayName ?: contact.givenName.ifBlank { "Contact" }
    val vcard = remember(contact.id) { VCardBuilder.build(contact) }
    val byteSize = remember(vcard) { VCardBuilder.byteSize(vcard) }
    val fitsInQr = byteSize <= VCardBuilder.MAX_QR_BYTES

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Share: $displayName") },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                if (fitsInQr) {
                    val qrBitmap = remember(vcard) { generateQrBitmap(vcard, 300) }
                    if (qrBitmap != null) {
                        Image(
                            bitmap = qrBitmap.asImageBitmap(),
                            contentDescription = "QR Code for $displayName",
                            modifier = Modifier.size(250.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "$displayName — vCard ($byteSize bytes)",
                        style = MaterialTheme.typography.bodySmall,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        text = "Contact data too large for QR ($byteSize bytes).\nUse Export instead.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    )
}

/**
 * Generate a QR code bitmap from a string using ZXing.
 */
internal fun generateQrBitmap(data: String, size: Int): Bitmap? {
    return try {
        val hints = mapOf(
            EncodeHintType.CHARACTER_SET to "UTF-8",
            EncodeHintType.MARGIN to 1,
            EncodeHintType.ERROR_CORRECTION to com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.L
        )
        val writer = QRCodeWriter()
        val bitMatrix = writer.encode(data, BarcodeFormat.QR_CODE, size, size, hints)

        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.RGB_565)
        for (x in 0 until size) {
            for (y in 0 until size) {
                bitmap.setPixel(x, y, if (bitMatrix[x, y]) 0xFF000000.toInt() else 0xFFFFFFFF.toInt())
            }
        }
        bitmap
    } catch (_: Exception) {
        null
    }
}

/**
 * Dialog that displays a QR code for a chit — supports Link and Data modes
 * with a toggle, matching the web's _showQRCode() in editor-save.js.
 */
@Composable
fun ChitQrCodeDialog(
    chitId: String,
    chitTitle: String,
    chitStatus: String = "",
    chitPriority: String = "",
    chitTags: List<String> = emptyList(),
    chitNote: String = "",
    chitDue: String = "",
    chitStart: String = "",
    chitEnd: String = "",
    serverUrl: String,
    onDismiss: () -> Unit
) {
    var mode by remember { mutableStateOf("data") }

    val linkData = remember(chitId, serverUrl) {
        "$serverUrl/frontend/html/editor.html?id=$chitId"
    }

    val jsonData = remember(chitId, chitTitle, chitStatus, chitPriority, chitTags, chitNote, chitDue, chitStart, chitEnd) {
        val obj = JSONObject()
        obj.put("_cwoc", "android")
        obj.put("id", chitId)
        obj.put("title", chitTitle)
        obj.put("status", chitStatus)
        obj.put("priority", chitPriority)
        obj.put("tags", chitTags.joinToString(";"))
        obj.put("note", chitNote.take(300))
        obj.put("due", chitDue)
        obj.put("start", chitStart)
        obj.put("end", chitEnd)
        obj.toString()
    }

    val currentData = if (mode == "link") linkData else jsonData
    val currentTitle = if (mode == "link") "🔗 Link QR Code" else "📦 Data QR Code"
    val currentInfo = if (mode == "link") linkData else "${jsonData.length} chars encoded"

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(currentTitle) },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val qrBitmap = remember(currentData) { generateQrBitmap(currentData, 300) }
                if (qrBitmap != null) {
                    Image(
                        bitmap = qrBitmap.asImageBitmap(),
                        contentDescription = "QR Code",
                        modifier = Modifier.size(250.dp)
                    )
                } else {
                    Text(
                        text = "Data too large for QR code.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.padding(vertical = 16.dp)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = currentInfo,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(12.dp))
                // Mode toggle row (matches web's _addModeToggle)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = { mode = "data" },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(4.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (mode == "data") CwocZoneHeaderBrown else CwocParchment,
                            contentColor = if (mode == "data") CwocParchment else CwocZoneHeaderBrown
                        )
                    ) {
                        Text("📦 Data")
                    }
                    OutlinedButton(
                        onClick = { mode = "link" },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(4.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (mode == "link") CwocZoneHeaderBrown else CwocParchment,
                            contentColor = if (mode == "link") CwocParchment else CwocZoneHeaderBrown
                        )
                    ) {
                        Text("🔗 Link")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Close") }
        }
    )
}
