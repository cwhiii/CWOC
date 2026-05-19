package com.cwoc.app.ui.screens.rules

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ─── Theme Colors ───────────────────────────────────────────────────────────────

private val ParchmentBrown = Color(0xFF6B4E31)
private val ParchmentText = Color(0xFF4A3520)
private val ParchmentLight = Color(0xFFF5E6D3)
private val ParchmentBg = Color(0xFFFDF5E6)

// Nesting level border colors — cycle through these for visual distinction
private val NestingColors = listOf(
    Color(0xFF6B4E31), // brown
    Color(0xFF8B5A2B), // saddle brown
    Color(0xFFA0522D), // sienna
    Color(0xFFCD853F), // peru
    Color(0xFFD2691E)  // chocolate
)

// ─── Data Model ─────────────────────────────────────────────────────────────────

/**
 * Represents a field option available for condition leaves.
 * Passed in from the parent screen based on the rule's trigger type.
 */
data class FieldOption(
    val value: String,
    val label: String
)

/**
 * Operators available for condition leaves.
 * Matches the web app's OPERATOR_GROUPS.
 */
val CONDITION_OPERATORS = listOf(
    "equals" to "equals",
    "not_equals" to "not equals",
    "contains" to "contains",
    "not_contains" to "not contains",
    "greater_than" to "greater than",
    "less_than" to "less than",
    "starts_with" to "starts with",
    "ends_with" to "ends with",
    "is_empty" to "is empty",
    "is_not_empty" to "is not empty"
)

/** Operators that don't require a value input */
private val NO_VALUE_OPERATORS = setOf("is_empty", "is_not_empty")

// ─── Main Entry Point ───────────────────────────────────────────────────────────

/**
 * Recursive composable that renders a condition tree for the rule editor.
 * Supports arbitrary nesting depth matching the web's recursive condition tree UI.
 *
 * @param root The root condition group
 * @param onTreeChange Callback when the tree is modified
 * @param availableFields List of fields available for condition leaves
 */
@Composable
fun ConditionTreeBuilder(
    root: ConditionNode.Group,
    onTreeChange: (ConditionNode.Group) -> Unit,
    availableFields: List<FieldOption>
) {
    ConditionGroupView(
        group = root,
        depth = 0,
        isRoot = true,
        availableFields = availableFields,
        onGroupChange = { updatedGroup -> onTreeChange(updatedGroup) },
        onRemove = {} // Root cannot be removed
    )
}

// ─── Group View ─────────────────────────────────────────────────────────────────

/**
 * Renders a condition group with AND/OR toggle, children (recursive), and action buttons.
 */
@Composable
private fun ConditionGroupView(
    group: ConditionNode.Group,
    depth: Int,
    isRoot: Boolean,
    availableFields: List<FieldOption>,
    onGroupChange: (ConditionNode.Group) -> Unit,
    onRemove: () -> Unit
) {
    val borderColor = NestingColors[depth % NestingColors.size]
    val indentPadding = (depth * 4).dp

    Box(
        modifier = Modifier
            .padding(start = indentPadding)
            .drawBehind {
                // Draw left border for visual nesting
                drawLine(
                    color = borderColor,
                    start = Offset(0f, 0f),
                    end = Offset(0f, size.height),
                    strokeWidth = 2.dp.toPx()
                )
            }
            .padding(start = 8.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    color = if (depth % 2 == 0) ParchmentBg else ParchmentLight,
                    shape = RoundedCornerShape(4.dp)
                )
                .border(
                    width = 1.dp,
                    color = borderColor.copy(alpha = 0.3f),
                    shape = RoundedCornerShape(4.dp)
                )
                .padding(8.dp)
        ) {
            // ─── Header: AND/OR toggle + Remove button ──────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // AND/OR toggle
                AndOrToggle(
                    currentOperator = group.operator,
                    onToggle = { newOp ->
                        onGroupChange(group.copy(operator = newOp))
                    }
                )

                // Remove button (not shown for root)
                if (!isRoot) {
                    IconButton(
                        onClick = onRemove,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Text(
                            text = "×",
                            color = Color(0xFFC62828),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ─── Children ───────────────────────────────────────────────
            group.children.forEachIndexed { index, child ->
                when (child) {
                    is ConditionNode.Group -> {
                        ConditionGroupView(
                            group = child,
                            depth = depth + 1,
                            isRoot = false,
                            availableFields = availableFields,
                            onGroupChange = { updatedChild ->
                                val newChildren = group.children.toMutableList()
                                newChildren[index] = updatedChild
                                onGroupChange(group.copy(children = newChildren))
                            },
                            onRemove = {
                                val newChildren = group.children.toMutableList()
                                newChildren.removeAt(index)
                                onGroupChange(group.copy(children = newChildren))
                            }
                        )
                    }
                    is ConditionNode.Leaf -> {
                        ConditionLeafView(
                            leaf = child,
                            availableFields = availableFields,
                            onLeafChange = { updatedLeaf ->
                                val newChildren = group.children.toMutableList()
                                newChildren[index] = updatedLeaf
                                onGroupChange(group.copy(children = newChildren))
                            },
                            onRemove = {
                                val newChildren = group.children.toMutableList()
                                newChildren.removeAt(index)
                                onGroupChange(group.copy(children = newChildren))
                            }
                        )
                    }
                }

                if (index < group.children.size - 1) {
                    Spacer(modifier = Modifier.height(6.dp))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // ─── Action Buttons: + Condition, + Group ───────────────────
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TextButton(
                    onClick = {
                        val newChildren = group.children.toMutableList()
                        newChildren.add(ConditionNode.Leaf())
                        onGroupChange(group.copy(children = newChildren))
                    }
                ) {
                    Text(
                        text = "+ Condition",
                        color = ParchmentBrown,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                TextButton(
                    onClick = {
                        val newChildren = group.children.toMutableList()
                        newChildren.add(ConditionNode.Group())
                        onGroupChange(group.copy(children = newChildren))
                    }
                ) {
                    Text(
                        text = "+ Group",
                        color = ParchmentBrown,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
    }
}

// ─── Leaf View ──────────────────────────────────────────────────────────────────

/**
 * Renders a single condition leaf with field dropdown, operator dropdown,
 * value text field, and remove button.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ConditionLeafView(
    leaf: ConditionNode.Leaf,
    availableFields: List<FieldOption>,
    onLeafChange: (ConditionNode.Leaf) -> Unit,
    onRemove: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = Color.White.copy(alpha = 0.5f),
                shape = RoundedCornerShape(4.dp)
            )
            .border(
                width = 1.dp,
                color = ParchmentBrown.copy(alpha = 0.2f),
                shape = RoundedCornerShape(4.dp)
            )
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Field dropdown
        CompactDropdown(
            selectedValue = leaf.field,
            options = availableFields.map { it.value to it.label },
            placeholder = "Field",
            onValueChange = { newField ->
                onLeafChange(leaf.copy(field = newField))
            },
            modifier = Modifier.weight(1f)
        )

        // Operator dropdown
        CompactDropdown(
            selectedValue = leaf.operator,
            options = CONDITION_OPERATORS,
            placeholder = "Operator",
            onValueChange = { newOp ->
                onLeafChange(leaf.copy(operator = newOp))
            },
            modifier = Modifier.weight(1f)
        )

        // Value text field (hidden for is_empty/is_not_empty)
        if (leaf.operator !in NO_VALUE_OPERATORS) {
            OutlinedTextField(
                value = leaf.value,
                onValueChange = { newValue ->
                    onLeafChange(leaf.copy(value = newValue))
                },
                placeholder = { Text("Value", fontSize = 12.sp) },
                singleLine = true,
                textStyle = MaterialTheme.typography.bodySmall,
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
            )
        }

        // Remove button (×)
        IconButton(
            onClick = onRemove,
            modifier = Modifier.size(28.dp)
        ) {
            Text(
                text = "×",
                color = Color(0xFFC62828),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// ─── AND/OR Toggle ──────────────────────────────────────────────────────────────

/**
 * Two-button toggle for AND/OR operator selection.
 * Active button is highlighted with brown background.
 */
@Composable
private fun AndOrToggle(
    currentOperator: String,
    onToggle: (String) -> Unit
) {
    Row(
        modifier = Modifier
            .border(
                width = 1.dp,
                color = ParchmentBrown,
                shape = RoundedCornerShape(4.dp)
            )
    ) {
        // AND button
        Box(
            modifier = Modifier
                .background(
                    color = if (currentOperator == "AND") ParchmentBrown else Color.Transparent,
                    shape = RoundedCornerShape(topStart = 4.dp, bottomStart = 4.dp)
                )
                .clickable { onToggle("AND") }
                .padding(horizontal = 12.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "AND",
                color = if (currentOperator == "AND") Color.White else ParchmentText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }

        // OR button
        Box(
            modifier = Modifier
                .background(
                    color = if (currentOperator == "OR") ParchmentBrown else Color.Transparent,
                    shape = RoundedCornerShape(topEnd = 4.dp, bottomEnd = 4.dp)
                )
                .clickable { onToggle("OR") }
                .padding(horizontal = 12.dp, vertical = 6.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "OR",
                color = if (currentOperator == "OR") Color.White else ParchmentText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// ─── Compact Dropdown ───────────────────────────────────────────────────────────

/**
 * A compact dropdown for use within condition leaves.
 * Shows the selected value (or placeholder) and expands to show options.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CompactDropdown(
    selectedValue: String,
    options: List<Pair<String, String>>, // value to label
    placeholder: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.find { it.first == selectedValue }?.second ?: ""

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            placeholder = { Text(placeholder, fontSize = 12.sp) },
            textStyle = MaterialTheme.typography.bodySmall,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label, fontSize = 13.sp) },
                    onClick = {
                        onValueChange(value)
                        expanded = false
                    }
                )
            }
        }
    }
}
