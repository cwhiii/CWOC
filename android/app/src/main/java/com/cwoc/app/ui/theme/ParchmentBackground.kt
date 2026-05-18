package com.cwoc.app.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.cwoc.app.R

/**
 * A composable that renders the CWOC parchment background texture behind its content.
 * Uses the parchment-bg.jpg texture overlaid on the theme background color.
 *
 * Usage:
 *   ParchmentBackground {
 *       // your screen content
 *   }
 */
@Composable
fun ParchmentBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Parchment texture layer
        Image(
            painter = painterResource(id = R.drawable.parchment_bg),
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop,
            alpha = 0.3f // Subtle texture overlay, not overpowering
        )
        // Content on top
        content()
    }
}
