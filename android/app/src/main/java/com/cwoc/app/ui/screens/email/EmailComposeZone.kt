package com.cwoc.app.ui.screens.email

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/**
 * Email compose zone displayed within the chit editor when emailStatus == "draft".
 * Provides From, To, CC, BCC, Subject, Body fields and Send/Send Later/Discard actions.
 */
@Composable
fun EmailComposeZone(
    emailFrom: String?,
    emailTo: String?,
    emailCc: String?,
    emailBcc: String?,
    emailSubject: String?,
    emailBody: String?,
    onFromChange: (String) -> Unit,
    onToChange: (String) -> Unit,
    onCcChange: (String) -> Unit,
    onBccChange: (String) -> Unit,
    onSubjectChange: (String) -> Unit,
    onBodyChange: (String) -> Unit,
    onSend: () -> Unit,
    onSendLater: () -> Unit,
    onDiscard: () -> Unit,
    modifier: Modifier = Modifier
) {
    var showCcBcc by remember { mutableStateOf(!emailCc.isNullOrBlank() || !emailBcc.isNullOrBlank()) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Section header
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "✉️ Compose Email",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
        }

        // From field
        OutlinedTextField(
            value = emailFrom ?: "",
            onValueChange = { onFromChange(it) },
            label = { Text("From") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // To field
        OutlinedTextField(
            value = emailTo ?: "",
            onValueChange = { onToChange(it) },
            label = { Text("To") },
            singleLine = true,
            placeholder = { Text("recipient@example.com") },
            modifier = Modifier.fillMaxWidth()
        )

        // CC/BCC toggle
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = { showCcBcc = !showCcBcc }) {
                Icon(
                    imageVector = if (showCcBcc) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (showCcBcc) "Hide CC/BCC" else "Show CC/BCC",
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(if (showCcBcc) "Hide CC/BCC" else "Show CC/BCC")
            }
        }

        // CC field (collapsible)
        AnimatedVisibility(
            visible = showCcBcc,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = emailCc ?: "",
                    onValueChange = { onCcChange(it) },
                    label = { Text("CC") },
                    singleLine = true,
                    placeholder = { Text("cc@example.com") },
                    modifier = Modifier.fillMaxWidth()
                )

                // BCC field (collapsible)
                OutlinedTextField(
                    value = emailBcc ?: "",
                    onValueChange = { onBccChange(it) },
                    label = { Text("BCC") },
                    singleLine = true,
                    placeholder = { Text("bcc@example.com") },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        // Subject field
        OutlinedTextField(
            value = emailSubject ?: "",
            onValueChange = { onSubjectChange(it) },
            label = { Text("Subject") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        // Body field (multi-line, markdown capable)
        OutlinedTextField(
            value = emailBody ?: "",
            onValueChange = { onBodyChange(it) },
            label = { Text("Body") },
            minLines = 8,
            maxLines = 20,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(4.dp))

        HorizontalDivider()

        Spacer(modifier = Modifier.height(4.dp))

        // Action buttons row: Send, Send Later, Discard
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Send button (primary)
            Button(
                onClick = onSend,
                enabled = !emailTo.isNullOrBlank(),
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Send,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Send")
            }

            // Send Later button (secondary)
            OutlinedButton(
                onClick = onSendLater,
                enabled = !emailTo.isNullOrBlank()
            ) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Later")
            }

            // Discard button (danger/tertiary)
            IconButton(onClick = onDiscard) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Discard draft",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
