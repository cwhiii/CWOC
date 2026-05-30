package com.cwoc.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.sync.NetworkFallbackState

/**
 * A thin banner displayed below the top app bar when the app is operating
 * on the fallback URL. Shows "Connected via Tailscale" or "Connected via LAN".
 *
 * Non-intrusive — does not block interaction with app controls.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.5
 */
@Composable
fun FallbackBanner(fallbackState: NetworkFallbackState) {
    val isFallback by fallbackState.isFallback.collectAsState()
    val label by fallbackState.activeLabel.collectAsState()

    AnimatedVisibility(
        visible = isFallback,
        enter = expandVertically(),
        exit = shrinkVertically()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFFFFF3CD))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.SwapHoriz,
                contentDescription = "Network fallback active",
                tint = Color(0xFF856404)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Connected via $label",
                color = Color(0xFF856404),
                fontSize = 13.sp
            )
        }
    }
}
