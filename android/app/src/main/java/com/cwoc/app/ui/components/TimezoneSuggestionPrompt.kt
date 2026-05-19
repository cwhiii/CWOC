package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.ui.theme.LoraFontFamily

// Colors matching web spec Section 10
private val TzSuggestBg = Color(0x0F008080)           // rgba(0,128,128,0.06)
private val TzSuggestBorder = Color(0x4D008080)       // rgba(0,128,128,0.3)
private val TzSuggestText = Color(0xFF1A1208)         // #1a1208
private val TzSuggestUseBg = Color(0xFF008080)        // #008080
private val TzSuggestUsePressed = Color(0xFF006666)   // #006666
private val TzSuggestUseText = Color(0xFFFFFAF0)      // #fffaf0
private val TzSuggestUseBorder = Color(0xFF8B5A2B)    // #8b5a2b
private val TzSuggestDismissBg = Color(0xFFF5EBE0)    // #f5ebe0
private val TzSuggestDismissPressed = Color(0xFFE8D5C0) // #e8d5c0
private val TzSuggestDismissText = Color(0xFF1A1208)  // #1a1208

/**
 * Inline timezone suggestion prompt that appears when a geocoded location
 * detects a different timezone than what's currently set.
 *
 * Matches web spec Section 10: teal-tinted background, column layout on mobile,
 * "📍 Detected: [timezone]" text with Use/Dismiss buttons.
 *
 * Trigger conditions (enforced by parent):
 * - Geocoded location detects a different timezone
 * - No explicit timezone is currently set
 * - Date mode is not "None"
 *
 * @param detectedTimezone The IANA timezone name detected from geocoding (e.g., "America/Denver")
 * @param onUse Called when user taps "Use" — parent applies timezone, updates labels, marks unsaved, removes prompt
 * @param onDismiss Called when user taps "Dismiss" — parent removes prompt without timezone change
 */
@Composable
fun TimezoneSuggestionPrompt(
    detectedTimezone: String,
    onUse: () -> Unit,
    onDismiss: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 6.dp)
            .background(TzSuggestBg, RoundedCornerShape(4.dp))
            .border(1.dp, TzSuggestBorder, RoundedCornerShape(4.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.Start
    ) {
        // Detected timezone text
        Text(
            text = "📍 Detected: $detectedTimezone",
            fontFamily = LoraFontFamily,
            fontSize = 14.sp, // 0.85em relative to ~16sp base
            color = TzSuggestText,
            fontWeight = FontWeight.Normal,
            modifier = Modifier.fillMaxWidth()
        )

        // Use button
        val useInteractionSource = remember { MutableInteractionSource() }
        val usePressed by useInteractionSource.collectIsPressedAsState()

        Button(
            onClick = onUse,
            interactionSource = useInteractionSource,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 38.dp),
            shape = RoundedCornerShape(4.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (usePressed) TzSuggestUsePressed else TzSuggestUseBg,
                contentColor = TzSuggestUseText
            ),
            border = androidx.compose.foundation.BorderStroke(1.dp, TzSuggestUseBorder),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                horizontal = 12.dp,
                vertical = 8.dp
            )
        ) {
            Text(
                text = "Use",
                fontFamily = LoraFontFamily,
                fontSize = 14.sp, // 0.85em
                fontWeight = FontWeight.Normal
            )
        }

        // Dismiss button
        val dismissInteractionSource = remember { MutableInteractionSource() }
        val dismissPressed by dismissInteractionSource.collectIsPressedAsState()

        Button(
            onClick = onDismiss,
            interactionSource = dismissInteractionSource,
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 38.dp),
            shape = RoundedCornerShape(4.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (dismissPressed) TzSuggestDismissPressed else TzSuggestDismissBg,
                contentColor = TzSuggestDismissText
            ),
            border = androidx.compose.foundation.BorderStroke(1.dp, TzSuggestUseBorder),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                horizontal = 12.dp,
                vertical = 8.dp
            )
        ) {
            Text(
                text = "Dismiss",
                fontFamily = LoraFontFamily,
                fontSize = 14.sp, // 0.85em
                fontWeight = FontWeight.Normal
            )
        }
    }
}
