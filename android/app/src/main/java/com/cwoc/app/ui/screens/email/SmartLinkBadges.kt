package com.cwoc.app.ui.screens.email

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Flight
import androidx.compose.material.icons.filled.Hotel
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Train
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.cwoc.app.domain.email.SmartLink

/**
 * Displays a row of smart link badge chips for detected tracking patterns
 * in an email body. Each badge shows a category icon and label, and opens
 * the tracking URL in the device browser when tapped.
 *
 * @param smartLinks List of detected SmartLink objects from SmartLinkDetector
 * @param modifier Optional modifier for the container
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SmartLinkBadges(
    smartLinks: List<SmartLink>,
    modifier: Modifier = Modifier
) {
    if (smartLinks.isEmpty()) return

    val context = LocalContext.current

    FlowRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        for (link in smartLinks) {
            AssistChip(
                onClick = {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link.url))
                    context.startActivity(intent)
                },
                label = {
                    Text(
                        text = link.label,
                        style = MaterialTheme.typography.labelSmall
                    )
                },
                leadingIcon = {
                    Icon(
                        imageVector = categoryIcon(link.category),
                        contentDescription = link.category,
                        modifier = Modifier.size(AssistChipDefaults.IconSize)
                    )
                }
            )
        }
    }
}

/**
 * Maps a smart link category string to the appropriate Material icon.
 */
private fun categoryIcon(category: String): ImageVector {
    return when (category.lowercase()) {
        "package" -> Icons.Filled.LocalShipping
        "flight" -> Icons.Filled.Flight
        "hotel" -> Icons.Filled.Hotel
        "rental" -> Icons.Filled.DirectionsCar
        "event" -> Icons.Filled.ConfirmationNumber
        "restaurant" -> Icons.Filled.Restaurant
        "transit" -> Icons.Filled.Train
        "order" -> Icons.Filled.Receipt
        else -> Icons.Filled.LocalShipping
    }
}
