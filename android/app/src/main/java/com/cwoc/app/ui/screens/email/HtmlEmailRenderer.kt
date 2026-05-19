package com.cwoc.app.ui.screens.email

import android.content.Intent
import android.graphics.Color as AndroidColor
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

// ─── HTML Email Renderer — Sandboxed WebView ──────────────────────────────────

/**
 * Renders HTML email content in a sandboxed WebView with JavaScript disabled.
 *
 * Features:
 * - HTML sanitization: removes script, iframe, object, embed, form, input, button, select, textarea tags
 * - External content blocking based on setting (block/allow/known_senders)
 * - "External images blocked" banner with "Load External Content" button
 * - Links open in device browser
 * - Auto-resize WebView height (clamped 200-800dp)
 * - HTML/Text toggle pill to switch between rendered HTML and plain text
 *
 * @param htmlBody The raw HTML email body content
 * @param textBody The plain text email body (fallback for text mode)
 * @param externalContentSetting The privacy setting: "block", "allow", or "known_senders"
 * @param isSenderKnown Whether the sender is in the user's contacts (for known_senders mode)
 * @param modifier Optional modifier
 */
@Composable
fun HtmlEmailRenderer(
    htmlBody: String,
    textBody: String?,
    externalContentSetting: String,
    isSenderKnown: Boolean,
    modifier: Modifier = Modifier
) {
    var showHtml by remember { mutableStateOf(true) }
    var externalContentLoaded by remember { mutableStateOf(false) }

    // Determine if external images should be blocked
    val shouldBlockExternal = remember(externalContentSetting, isSenderKnown, externalContentLoaded) {
        when {
            externalContentLoaded -> false
            externalContentSetting == "allow" -> false
            externalContentSetting == "known_senders" && isSenderKnown -> false
            else -> true // "block" or "known_senders" with unknown sender
        }
    }

    // Sanitize HTML and optionally block external images
    val processedHtml = remember(htmlBody, shouldBlockExternal) {
        val sanitized = sanitizeHtml(htmlBody)
        if (shouldBlockExternal) {
            blockExternalImages(sanitized)
        } else {
            sanitized
        }
    }

    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // HTML/Text toggle pill
        HtmlTextToggle(
            showHtml = showHtml,
            onToggle = { showHtml = it }
        )

        // External images blocked banner
        if (shouldBlockExternal && showHtml) {
            ExternalContentBanner(
                onLoadContent = { externalContentLoaded = true }
            )
        }

        // Content area
        if (showHtml) {
            HtmlWebView(
                html = processedHtml,
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            // Plain text view
            PlainTextView(
                text = textBody ?: htmlToPlainText(htmlBody),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ─── HTML/Text Toggle Pill ────────────────────────────────────────────────────

/**
 * Two-option pill toggle for switching between HTML and Text views.
 * Follows the cwoc-2val-toggle pattern from the design system.
 */
@Composable
private fun HtmlTextToggle(
    showHtml: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Surface(
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.padding(horizontal = 4.dp)
    ) {
        Row(
            modifier = Modifier.padding(2.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            // HTML option
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = if (showHtml) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant,
                onClick = { onToggle(true) },
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = "HTML",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (showHtml) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    maxLines = 1
                )
            }

            // Text option
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = if (!showHtml) MaterialTheme.colorScheme.primary
                else MaterialTheme.colorScheme.surfaceVariant,
                onClick = { onToggle(false) },
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = "Text",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Medium,
                    color = if (!showHtml) MaterialTheme.colorScheme.onPrimary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    maxLines = 1
                )
            }
        }
    }
}

// ─── External Content Banner ──────────────────────────────────────────────────

/**
 * Banner displayed when external images are blocked.
 * Shows "External images blocked" message with a "Load External Content" button.
 */
@Composable
private fun ExternalContentBanner(
    onLoadContent: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.secondaryContainer,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Block,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.padding(end = 8.dp)
                )
                Text(
                    text = "External images blocked",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            TextButton(onClick = onLoadContent) {
                Text(
                    text = "Load External Content",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

// ─── WebView Composable ───────────────────────────────────────────────────────

/**
 * Sandboxed WebView for rendering HTML email content.
 * - JavaScript disabled
 * - Links open in device browser
 * - Auto-resizes height between 200-800dp based on content
 */
@Composable
private fun HtmlWebView(
    html: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    var webViewHeight by remember { mutableIntStateOf(200) }

    // Wrap HTML in a basic document structure with viewport meta
    val wrappedHtml = remember(html) {
        buildString {
            append("<!DOCTYPE html><html><head>")
            append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0\">")
            append("<style>")
            append("body { margin: 0; padding: 8px; font-family: sans-serif; font-size: 14px; ")
            append("word-wrap: break-word; overflow-wrap: break-word; }")
            append("img { max-width: 100%; height: auto; }")
            append("table { max-width: 100%; }")
            append("pre { white-space: pre-wrap; word-wrap: break-word; }")
            append("</style></head><body>")
            append(html)
            append("</body></html>")
        }
    }

    Box(
        modifier = modifier
            .heightIn(min = 200.dp, max = 800.dp)
    ) {
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    // Sandboxed settings — JavaScript disabled
                    settings.javaScriptEnabled = false
                    settings.loadWithOverviewMode = true
                    settings.useWideViewPort = true
                    settings.builtInZoomControls = false
                    settings.displayZoomControls = false
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false

                    // Transparent background to blend with app theme
                    setBackgroundColor(AndroidColor.TRANSPARENT)

                    // Force links to open in device browser
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            request?.url?.let { uri ->
                                val intent = Intent(Intent.ACTION_VIEW, uri)
                                ctx.startActivity(intent)
                            }
                            return true
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            // Auto-resize based on content height
                            view?.let { wv ->
                                val contentHeightPx = wv.contentHeight
                                if (contentHeightPx > 0) {
                                    val heightDp = with(density) {
                                        contentHeightPx.toDp().value.toInt()
                                    }
                                    // Clamp between 200-800dp
                                    webViewHeight = heightDp.coerceIn(200, 800)
                                }
                            }
                        }
                    }

                    // Load the sanitized HTML
                    loadDataWithBaseURL(
                        null,
                        wrappedHtml,
                        "text/html",
                        "UTF-8",
                        null
                    )
                }
            },
            update = { webView ->
                webView.loadDataWithBaseURL(
                    null,
                    wrappedHtml,
                    "text/html",
                    "UTF-8",
                    null
                )
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(webViewHeight.dp)
        )
    }
}

// ─── Plain Text View ──────────────────────────────────────────────────────────

/**
 * Read-only plain text display for the email body (text mode).
 */
@Composable
private fun PlainTextView(
    text: String,
    modifier: Modifier = Modifier
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        modifier = modifier
            .heightIn(min = 200.dp, max = 800.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier
                .padding(12.dp)
                .verticalScroll(rememberScrollState())
        )
    }
}

// ─── HTML Sanitization ────────────────────────────────────────────────────────

/**
 * Sanitizes HTML by removing forbidden tags: script, iframe, object, embed,
 * form, input, button, select, textarea.
 *
 * Uses regex-based removal of both opening/closing tags and self-closing tags,
 * plus removal of content between script/iframe/object/embed tags.
 */
internal fun sanitizeHtml(html: String): String {
    var result = html

    // Remove content-bearing dangerous tags (including their content)
    val contentRemovalTags = listOf("script", "iframe", "object", "embed")
    for (tag in contentRemovalTags) {
        result = result.replace(
            Regex("<$tag[^>]*>[\\s\\S]*?</$tag>", RegexOption.IGNORE_CASE),
            ""
        )
        // Also remove self-closing variants
        result = result.replace(
            Regex("<$tag[^>]*/?>", RegexOption.IGNORE_CASE),
            ""
        )
    }

    // Remove form-related tags (opening, closing, and self-closing) but keep content
    val tagOnlyRemoval = listOf("form", "input", "button", "select", "textarea")
    for (tag in tagOnlyRemoval) {
        result = result.replace(
            Regex("</?$tag[^>]*/?>", RegexOption.IGNORE_CASE),
            ""
        )
    }

    return result
}

/**
 * Replaces external image src attributes with a transparent placeholder.
 * Only blocks images with http:// or https:// sources (external).
 * Preserves data: URIs and relative paths.
 */
internal fun blockExternalImages(html: String): String {
    // Replace src attributes that point to external URLs (http/https)
    return html.replace(
        Regex("""(<img[^>]*\s)src\s*=\s*["'](https?://[^"']*)["']""", RegexOption.IGNORE_CASE),
        "$1src=\"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7\" data-blocked-src=\"$2\""
    )
}

/**
 * Converts HTML to plain text by stripping all tags and decoding common entities.
 * Used as fallback when no textBody is provided.
 */
private fun htmlToPlainText(html: String): String {
    return html
        .replace(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("</(p|div|h[1-6]|li|tr)>", RegexOption.IGNORE_CASE), "\n")
        .replace(Regex("<[^>]+>"), "")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace(Regex("\\n{3,}"), "\n\n")
        .trim()
}
