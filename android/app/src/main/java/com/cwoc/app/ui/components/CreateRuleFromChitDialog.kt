package com.cwoc.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cwoc.app.data.local.entity.ChitEntity
import com.cwoc.app.ui.theme.CwocDialogDefaults
import com.cwoc.app.ui.theme.CwocOutline
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Data class representing a rule-eligible field from a chit.
 */
data class RuleFieldOption(
    val field: String,
    val label: String,
    val value: String,
    val operator: String
)

/**
 * Dialog that shows populated fields from a chit that can be used as rule conditions.
 * Mirrors the web's _showCreateRuleFromChitModal() behavior.
 *
 * @param chit The chit to extract fields from.
 * @param onDismiss Called when the dialog is dismissed.
 * @param onFieldSelected Called with (triggerType, field, operator, value) when user confirms.
 */
@Composable
fun CreateRuleFromChitDialog(
    chit: ChitEntity,
    onDismiss: () -> Unit,
    onFieldSelected: (trigger: String, field: String, operator: String, value: String) -> Unit
) {
    val fields = remember(chit) { extractRuleFields(chit) }
    var selectedIndex by remember { mutableIntStateOf(0) }

    if (fields.isEmpty()) {
        // No eligible fields — shouldn't normally happen since we check before showing
        onDismiss()
        return
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = CwocDialogDefaults.containerColor,
        title = {
            Text(
                text = "Create a Rule",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        },
        text = {
            Column {
                Text(
                    text = "Select a field to base the rule condition on:",
                    fontSize = 14.sp,
                    color = CwocOutline,
                    modifier = Modifier.padding(bottom = 12.dp)
                )
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .fillMaxWidth()
                ) {
                    fields.forEachIndexed { index, field ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { selectedIndex = index }
                                .padding(vertical = 6.dp, horizontal = 4.dp)
                        ) {
                            RadioButton(
                                selected = selectedIndex == index,
                                onClick = { selectedIndex = index },
                                colors = RadioButtonDefaults.colors(
                                    selectedColor = CwocOutline
                                )
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = field.label,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val selected = fields[selectedIndex]
                val isEmail = chit.emailMessageId != null || chit.emailFrom != null || chit.emailStatus != null
                val trigger = if (isEmail) "email_received" else "chit_updated"
                onFieldSelected(trigger, selected.field, selected.operator, selected.value)
                onDismiss()
            }) {
                Text("Create Rule", color = CwocOutline)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

/**
 * Extract rule-eligible populated fields from a ChitEntity.
 * Mirrors the web's field extraction logic in _showCreateRuleFromChitModal.
 */
private fun extractRuleFields(chit: ChitEntity): List<RuleFieldOption> {
    val fields = mutableListOf<RuleFieldOption>()
    val gson = Gson()

    // Core fields
    if (!chit.title.isNullOrBlank()) {
        fields.add(RuleFieldOption("title", "Title: ${chit.title}", chit.title!!, "contains"))
    }
    if (!chit.status.isNullOrBlank()) {
        fields.add(RuleFieldOption("status", "Status: ${chit.status}", chit.status!!, "equals"))
    }
    if (!chit.priority.isNullOrBlank()) {
        fields.add(RuleFieldOption("priority", "Priority: ${chit.priority}", chit.priority!!, "equals"))
    }
    if (!chit.severity.isNullOrBlank()) {
        fields.add(RuleFieldOption("severity", "Severity: ${chit.severity}", chit.severity!!, "equals"))
    }
    if (!chit.location.isNullOrBlank()) {
        fields.add(RuleFieldOption("location", "Location: ${chit.location}", chit.location!!, "contains"))
    }
    if (!chit.color.isNullOrBlank()) {
        fields.add(RuleFieldOption("color", "Color: ${chit.color}", chit.color!!, "equals"))
    }

    // Tags
    val tagsList = chit.tags
    if (!tagsList.isNullOrEmpty()) {
        val systemTags = setOf("Calendar", "Checklists", "Alarms", "Projects", "Tasks", "Notes")
        tagsList.filter { it.isNotBlank() && it !in systemTags }.forEach { tag ->
            fields.add(RuleFieldOption("tags", "Tag: $tag", tag, "tag_present"))
        }
    }

    // People
    val peopleList = chit.people
    if (!peopleList.isNullOrEmpty()) {
        peopleList.filter { it.isNotBlank() }.forEach { person ->
            fields.add(RuleFieldOption("people", "Person: $person", person, "person_on_chit"))
        }
    }

    // Email fields
    if (chit.emailFrom != null || chit.emailMessageId != null || chit.emailStatus != null) {
        if (!chit.emailFrom.isNullOrBlank()) {
            val senderEmail = extractEmailAddress(chit.emailFrom!!)
            fields.add(RuleFieldOption("email_from", "From: $senderEmail", senderEmail, "contains"))
        }
        if (!chit.emailTo.isNullOrBlank()) {
            val toRaw = chit.emailTo!!
            val toEmail = try {
                val list: List<String> = gson.fromJson(toRaw, object : TypeToken<List<String>>() {}.type)
                extractEmailAddress(list.firstOrNull() ?: "")
            } catch (_: Exception) {
                extractEmailAddress(toRaw)
            }
            if (toEmail.isNotBlank()) {
                fields.add(RuleFieldOption("email_to", "To: $toEmail", toEmail, "contains"))
            }
        }
        if (!chit.emailSubject.isNullOrBlank()) {
            fields.add(RuleFieldOption("email_subject", "Subject: ${chit.emailSubject}", chit.emailSubject!!, "contains"))
        }
    }

    // Note (only if short enough to be useful as a condition)
    if (!chit.note.isNullOrBlank() && chit.note!!.trim().length <= 100) {
        fields.add(RuleFieldOption("note", "Note contains text", chit.note!!.trim(), "contains"))
    }

    return fields
}

/**
 * Extract email address from a "Name <email>" format string.
 */
private fun extractEmailAddress(raw: String): String {
    val match = Regex("<([^>]+)>").find(raw)
    return match?.groupValues?.get(1) ?: raw.trim()
}
