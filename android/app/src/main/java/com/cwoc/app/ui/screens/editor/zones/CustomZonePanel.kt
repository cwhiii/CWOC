package com.cwoc.app.ui.screens.editor.zones

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cwoc.app.data.local.entity.SettingsEntity
import com.cwoc.app.data.remote.IndicatorObject
import com.cwoc.app.ui.screens.editor.CustomZoneState
import com.cwoc.app.ui.screens.editor.evaluateConditionalDisplay
import com.cwoc.app.ui.screens.editor.rangeHighlightColor
import com.cwoc.app.ui.screens.editor.resolveUnitLabel
import com.cwoc.app.ui.theme.CwocInputDefaults

/**
 * Renders a single custom zone as a collapsible panel with typed input fields.
 * Groups objects by sub_type (or type, or "Other") with collapsible sub-sections.
 *
 * Each object is rendered as the appropriate input type based on value_type:
 * - "integer" → OutlinedTextField with KeyboardType.Number
 * - "decimal" → OutlinedTextField with KeyboardType.Decimal
 * - "boolean" → Row with Checkbox + Text
 * - "string" → OutlinedTextField with KeyboardType.Text
 *
 * Displays unit labels via resolveUnitLabel() for numeric fields.
 * Applies range highlighting via rangeHighlightColor() as background on numeric fields.
 * Updates highlight in real-time as user types.
 *
 * Validates: Requirements 3.2, 6.6, 7.4, 7.8
 *
 * @param zone The zone metadata and objects
 * @param healthData Current health_data JSON string
 * @param settings Current user settings (for conditional display and unit system)
 * @param onHealthDataChange Callback when any field value changes
 */
@Composable
fun CustomZonePanel(
    zone: CustomZoneState,
    healthData: String?,
    settings: SettingsEntity?,
    onHealthDataChange: (String?) -> Unit
) {
    // Filter objects by conditional display rules
    val visibleObjects = remember(zone.objects, settings) {
        zone.objects.filter { obj ->
            evaluateConditionalDisplay(obj.conditional_display, settings)
        }
    }

    // If no visible objects remain, don't render the zone at all
    if (visibleObjects.isEmpty()) return

    // Parse health data JSON into a map
    val healthMap = remember(healthData) {
        try {
            if (healthData.isNullOrBlank()) mutableMapOf<String, Any?>()
            else com.google.gson.Gson().fromJson<MutableMap<String, Any?>>(
                healthData,
                object : com.google.gson.reflect.TypeToken<MutableMap<String, Any?>>() {}.type
            ) ?: mutableMapOf()
        } catch (_: Exception) { mutableMapOf() }
    }

    // Determine initial expansion: expanded if any object UUID has a stored value
    val hasStoredValues = remember(visibleObjects, healthMap) {
        visibleObjects.any { obj -> healthMap.containsKey(obj.id) && healthMap[obj.id] != null }
    }
    var isExpanded by remember { mutableStateOf(hasStoredValues) }

    // Group visible objects by sub_type ?: type ?: "Other", sorted alphabetically
    val groupedObjects = remember(visibleObjects) {
        visibleObjects
            .groupBy { it.sub_type ?: it.type ?: "Other" }
            .toSortedMap()
            .mapValues { (_, objs) ->
                objs.sortedBy { it.zone_sort_order ?: 0 }
            }
    }

    EditorZoneHeader(
        title = zone.name,
        isExpanded = isExpanded,
        onToggle = { isExpanded = !isExpanded },
        trailingContent = {
            if (!isExpanded && hasStoredValues) {
                val count = visibleObjects.count { obj ->
                    healthMap.containsKey(obj.id) && healthMap[obj.id] != null
                }
                if (count > 0) {
                    Text(
                        "$count recorded",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    ) {
        groupedObjects.forEach { (groupName, objects) ->
            // Group sub-header
            if (groupedObjects.size > 1) {
                Text(
                    text = groupName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                )
            }

            objects.forEach { obj ->
                CustomObjectField(
                    obj = obj,
                    healthMap = healthMap,
                    settings = settings,
                    onValueChange = { newValue ->
                        val updated = healthMap.toMutableMap()
                        if (newValue == null || (newValue is String && newValue.isBlank())) {
                            updated.remove(obj.id)
                        } else {
                            updated[obj.id] = newValue
                        }
                        onHealthDataChange(
                            if (updated.isEmpty()) null
                            else com.google.gson.Gson().toJson(updated)
                        )
                    }
                )
            }

            if (groupedObjects.size > 1) {
                Spacer(modifier = Modifier.height(4.dp))
            }
        }
    }
}

/**
 * Renders a single custom object as the appropriate input type based on value_type.
 *
 * - "integer" → OutlinedTextField with KeyboardType.Number, label = obj.name, suffix = unit label
 * - "decimal" → OutlinedTextField with KeyboardType.Decimal, label = obj.name, suffix = unit label
 * - "boolean" → Row with Checkbox + Text(obj.name)
 * - "string" → OutlinedTextField with KeyboardType.Text, label = obj.name
 *
 * For numeric fields, applies rangeHighlightColor as background modifier.
 * Updates highlight in real-time as user types.
 */
@Composable
private fun CustomObjectField(
    obj: IndicatorObject,
    healthMap: Map<String, Any?>,
    settings: SettingsEntity?,
    onValueChange: (Any?) -> Unit
) {
    when (obj.value_type) {
        "integer" -> NumericField(
            obj = obj,
            healthMap = healthMap,
            settings = settings,
            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
            onValueChange = onValueChange
        )
        "decimal" -> NumericField(
            obj = obj,
            healthMap = healthMap,
            settings = settings,
            keyboardType = androidx.compose.ui.text.input.KeyboardType.Decimal,
            onValueChange = onValueChange
        )
        "boolean" -> BooleanField(
            obj = obj,
            healthMap = healthMap,
            onValueChange = onValueChange
        )
        "string" -> StringField(
            obj = obj,
            healthMap = healthMap,
            onValueChange = onValueChange
        )
        else -> StringField(
            obj = obj,
            healthMap = healthMap,
            onValueChange = onValueChange
        )
    }
}

/**
 * Numeric input field (integer or decimal) with unit label and range highlighting.
 * Range highlight updates in real-time as the user types.
 */
@Composable
private fun NumericField(
    obj: IndicatorObject,
    healthMap: Map<String, Any?>,
    settings: SettingsEntity?,
    keyboardType: androidx.compose.ui.text.input.KeyboardType,
    onValueChange: (Any?) -> Unit
) {
    val storedValue = healthMap[obj.id]
    var textValue by remember(obj.id, storedValue) {
        mutableStateOf(
            when (storedValue) {
                is Number -> storedValue.toString().removeSuffix(".0")
                else -> storedValue?.toString() ?: ""
            }
        )
    }

    val unitLabel = resolveUnitLabel(obj, settings)
    val highlightColor = rangeHighlightColor(textValue, obj.range_min, obj.range_max)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = textValue,
            onValueChange = { newVal ->
                textValue = newVal
                // Convert to typed value for storage
                val typedValue: Any? = when {
                    newVal.isBlank() -> null
                    obj.value_type == "integer" -> newVal.toLongOrNull()
                    else -> newVal.toDoubleOrNull()
                }
                onValueChange(typedValue)
            },
            modifier = Modifier
                .weight(1f)
                .then(
                    if (highlightColor != null) {
                        Modifier.background(highlightColor, shape = androidx.compose.foundation.shape.RoundedCornerShape(4.dp))
                    } else {
                        Modifier
                    }
                ),
            label = { Text(obj.name) },
            singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                keyboardType = keyboardType
            ),
            suffix = if (unitLabel.isNotBlank()) {
                { Text(unitLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            } else null,
            colors = CwocInputDefaults.outlinedColors()
        )
    }
}

/**
 * Boolean input field rendered as a Checkbox with the object name as label.
 */
@Composable
private fun BooleanField(
    obj: IndicatorObject,
    healthMap: Map<String, Any?>,
    onValueChange: (Any?) -> Unit
) {
    val storedValue = healthMap[obj.id]
    var isChecked by remember(obj.id, storedValue) {
        mutableStateOf(
            when (storedValue) {
                is Boolean -> storedValue
                is String -> storedValue.equals("true", ignoreCase = true)
                else -> false
            }
        )
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = isChecked,
            onCheckedChange = { newVal ->
                isChecked = newVal
                onValueChange(newVal)
            }
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = obj.name,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

/**
 * String/text input field with KeyboardType.Text.
 */
@Composable
private fun StringField(
    obj: IndicatorObject,
    healthMap: Map<String, Any?>,
    onValueChange: (Any?) -> Unit
) {
    val storedValue = healthMap[obj.id]
    var textValue by remember(obj.id, storedValue) {
        mutableStateOf(storedValue?.toString() ?: "")
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OutlinedTextField(
            value = textValue,
            onValueChange = { newVal ->
                textValue = newVal
                onValueChange(if (newVal.isBlank()) null else newVal)
            },
            modifier = Modifier.weight(1f),
            label = { Text(obj.name) },
            singleLine = true,
            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                keyboardType = androidx.compose.ui.text.input.KeyboardType.Text
            ),
            colors = CwocInputDefaults.outlinedColors()
        )
    }
}
