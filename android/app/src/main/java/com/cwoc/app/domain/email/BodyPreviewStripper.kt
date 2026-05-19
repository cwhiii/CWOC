package com.cwoc.app.domain.email

/**
 * Pure function: strips HTML, markdown, URLs, zero-width characters,
 * collapses whitespace, and truncates to 250 characters.
 *
 * Used to generate clean body preview text for email cards.
 */
object BodyPreviewStripper {

    private const val MAX_PREVIEW_LENGTH = 250

    // Zero-width characters: ZWS, ZWNJ, ZWJ, ZWSP, BOM, word joiner, etc.
    private val ZERO_WIDTH_REGEX = Regex("[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2060\u00AD]")

    // Style blocks: <style>...</style> including multiline
    private val STYLE_BLOCK_REGEX = Regex("<style[^>]*>[\\s\\S]*?</style>", RegexOption.IGNORE_CASE)

    // Script blocks: <script>...</script> including multiline
    private val SCRIPT_BLOCK_REGEX = Regex("<script[^>]*>[\\s\\S]*?</script>", RegexOption.IGNORE_CASE)

    // All HTML tags
    private val HTML_TAG_REGEX = Regex("<[^>]+>")

    // HTML entities
    private val HTML_ENTITY_REGEX = Regex("&[a-zA-Z0-9#]+;")

    // Raw URLs (http/https)
    private val URL_REGEX = Regex("https?://\\S+")

    // Markdown bold/italic: **text**, __text__, *text*, _text_
    private val MD_BOLD_REGEX = Regex("\\*\\*(.+?)\\*\\*")
    private val MD_BOLD_ALT_REGEX = Regex("__(.+?)__")
    private val MD_ITALIC_REGEX = Regex("\\*(.+?)\\*")
    private val MD_ITALIC_ALT_REGEX = Regex("_(.+?)_")

    // Markdown strikethrough: ~~text~~
    private val MD_STRIKETHROUGH_REGEX = Regex("~~(.+?)~~")

    // Markdown inline code: `text`
    private val MD_CODE_REGEX = Regex("`(.+?)`")

    // Markdown links: [text](url)
    private val MD_LINK_REGEX = Regex("\\[([^\\]]*)]\\([^)]*\\)")

    // Markdown images: ![alt](url)
    private val MD_IMAGE_REGEX = Regex("!\\[([^\\]]*)]\\([^)]*\\)")

    // Markdown headings: # text, ## text, etc.
    private val MD_HEADING_REGEX = Regex("^#{1,6}\\s+", RegexOption.MULTILINE)

    // Markdown blockquotes: > text
    private val MD_BLOCKQUOTE_REGEX = Regex("^>\\s?", RegexOption.MULTILINE)

    // Markdown horizontal rules: ---, ***, ___
    private val MD_HR_REGEX = Regex("^[-*_]{3,}$", RegexOption.MULTILINE)

    // Markdown list markers: - item, * item, + item, 1. item
    private val MD_LIST_REGEX = Regex("^\\s*[-*+]\\s+", RegexOption.MULTILINE)
    private val MD_ORDERED_LIST_REGEX = Regex("^\\s*\\d+\\.\\s+", RegexOption.MULTILINE)

    // Multiple whitespace characters (spaces, tabs, newlines)
    private val WHITESPACE_REGEX = Regex("\\s+")

    /**
     * Strips all formatting from an email body and returns a clean text preview.
     *
     * Processing order:
     * 1. Remove style/script blocks (before stripping tags, so content inside is removed)
     * 2. Remove all HTML tags
     * 3. Decode HTML entities to plain text equivalents
     * 4. Remove markdown syntax markers
     * 5. Remove raw URLs
     * 6. Remove zero-width characters
     * 7. Collapse whitespace
     * 8. Trim and truncate to 250 characters
     *
     * @param body The raw email body text (may contain HTML, markdown, or plain text). Null returns empty string.
     * @return Clean preview text, max 250 characters.
     */
    fun strip(body: String?): String {
        if (body.isNullOrBlank()) return ""

        var text = body

        // 1. Remove style and script blocks (content + tags)
        text = STYLE_BLOCK_REGEX.replace(text, "")
        text = SCRIPT_BLOCK_REGEX.replace(text, "")

        // 2. Remove all HTML tags
        text = HTML_TAG_REGEX.replace(text, " ")

        // 3. Decode common HTML entities
        text = decodeHtmlEntities(text)

        // 4. Remove markdown syntax markers
        text = MD_IMAGE_REGEX.replace(text, "$1")       // ![alt](url) → alt
        text = MD_LINK_REGEX.replace(text, "$1")        // [text](url) → text
        text = MD_BOLD_REGEX.replace(text, "$1")        // **text** → text
        text = MD_BOLD_ALT_REGEX.replace(text, "$1")    // __text__ → text
        text = MD_STRIKETHROUGH_REGEX.replace(text, "$1") // ~~text~~ → text
        text = MD_CODE_REGEX.replace(text, "$1")        // `text` → text
        text = MD_ITALIC_REGEX.replace(text, "$1")      // *text* → text
        text = MD_ITALIC_ALT_REGEX.replace(text, "$1")  // _text_ → text
        text = MD_HEADING_REGEX.replace(text, "")       // # heading → heading
        text = MD_BLOCKQUOTE_REGEX.replace(text, "")    // > quote → quote
        text = MD_HR_REGEX.replace(text, "")            // --- → (removed)
        text = MD_ORDERED_LIST_REGEX.replace(text, "")  // 1. item → item
        text = MD_LIST_REGEX.replace(text, "")          // - item → item

        // 5. Remove raw URLs
        text = URL_REGEX.replace(text, "")

        // 6. Remove zero-width characters
        text = ZERO_WIDTH_REGEX.replace(text, "")

        // 7. Collapse whitespace
        text = WHITESPACE_REGEX.replace(text, " ")

        // 8. Trim and truncate
        text = text.trim()
        if (text.length > MAX_PREVIEW_LENGTH) {
            text = text.substring(0, MAX_PREVIEW_LENGTH)
        }

        return text
    }

    /**
     * Decodes common HTML entities to their plain text equivalents.
     */
    private fun decodeHtmlEntities(text: String): String {
        var result = text
        result = result.replace("&amp;", "&")
        result = result.replace("&lt;", "<")
        result = result.replace("&gt;", ">")
        result = result.replace("&quot;", "\"")
        result = result.replace("&#39;", "'")
        result = result.replace("&apos;", "'")
        result = result.replace("&nbsp;", " ")
        result = result.replace("&#160;", " ")
        result = result.replace("&mdash;", "—")
        result = result.replace("&ndash;", "–")
        result = result.replace("&hellip;", "…")
        result = result.replace("&copy;", "©")
        result = result.replace("&reg;", "®")
        result = result.replace("&trade;", "™")
        // Remove any remaining entities
        result = HTML_ENTITY_REGEX.replace(result, "")
        return result
    }
}
