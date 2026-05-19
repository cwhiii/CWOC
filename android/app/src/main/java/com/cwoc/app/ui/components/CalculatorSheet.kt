package com.cwoc.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Calculator bottom sheet with expression evaluation and insert-to-field capability.
 * Supports correct operator precedence (× and ÷ before + and -).
 * Live result preview as user types.
 *
 * Task 36: Calculator bottom sheet for the editor overflow menu.
 *
 * @param onDismiss Callback when the sheet is dismissed.
 * @param onInsert Callback with the result string to insert into the focused editor field.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalculatorSheet(
    onDismiss: () -> Unit,
    onInsert: (String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var expression by remember { mutableStateOf("") }

    val result = remember(expression) { evaluateExpression(expression) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Display area
            CalculatorDisplay(expression = expression, result = result)

            Spacer(modifier = Modifier.height(16.dp))

            // Number pad and operators grid
            CalculatorKeypad(
                onDigit = { digit -> if (expression.length < 50) expression += digit },
                onOperator = { op -> if (expression.length < 50) expression += " $op " },
                onClear = { expression = "" },
                onBackspace = {
                    if (expression.isNotEmpty()) {
                        // If ends with " op ", remove the whole operator token
                        val trimmed = expression.trimEnd()
                        if (trimmed.endsWith("+") || trimmed.endsWith("-") ||
                            trimmed.endsWith("×") || trimmed.endsWith("÷")
                        ) {
                            // Remove " op " (space + operator + trailing space)
                            expression = expression.dropLast(3)
                        } else {
                            expression = expression.dropLast(1)
                        }
                    }
                },
                onEquals = {
                    val evaluated = evaluateExpression(expression)
                    if (evaluated != "Error") {
                        expression = evaluated
                    }
                },
                onInsert = {
                    val insertValue = if (result != "Error" && result.isNotEmpty()) result else ""
                    if (insertValue.isNotEmpty()) {
                        onInsert(insertValue)
                    }
                }
            )

            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

/**
 * Display area showing the current expression and live result preview.
 */
@Composable
private fun CalculatorDisplay(expression: String, result: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(12.dp)
            )
            .padding(16.dp)
    ) {
        // Expression
        Text(
            text = expression.ifEmpty { "0" },
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
            maxLines = 2
        )
        Spacer(modifier = Modifier.height(4.dp))
        // Result preview
        Text(
            text = if (result.isNotEmpty() && result != "Error") "= $result" else "",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.End,
            maxLines = 1
        )
    }
}

/**
 * Calculator keypad with number buttons, operators, and action buttons.
 * Layout:
 *   7  8  9  ÷
 *   4  5  6  ×
 *   1  2  3  -
 *   0  .  =  +
 *   C  ⌫  Insert
 */
@Composable
private fun CalculatorKeypad(
    onDigit: (String) -> Unit,
    onOperator: (String) -> Unit,
    onClear: () -> Unit,
    onBackspace: () -> Unit,
    onEquals: () -> Unit,
    onInsert: () -> Unit
) {
    val operatorColor = Color(0xFF6B4E31) // Brown accent for operators

    // Row 1: 7 8 9 ÷
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CalcDigitButton("7", Modifier.weight(1f)) { onDigit("7") }
        CalcDigitButton("8", Modifier.weight(1f)) { onDigit("8") }
        CalcDigitButton("9", Modifier.weight(1f)) { onDigit("9") }
        CalcOperatorButton("÷", operatorColor, Modifier.weight(1f)) { onOperator("÷") }
    }

    Spacer(modifier = Modifier.height(8.dp))

    // Row 2: 4 5 6 ×
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CalcDigitButton("4", Modifier.weight(1f)) { onDigit("4") }
        CalcDigitButton("5", Modifier.weight(1f)) { onDigit("5") }
        CalcDigitButton("6", Modifier.weight(1f)) { onDigit("6") }
        CalcOperatorButton("×", operatorColor, Modifier.weight(1f)) { onOperator("×") }
    }

    Spacer(modifier = Modifier.height(8.dp))

    // Row 3: 1 2 3 -
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CalcDigitButton("1", Modifier.weight(1f)) { onDigit("1") }
        CalcDigitButton("2", Modifier.weight(1f)) { onDigit("2") }
        CalcDigitButton("3", Modifier.weight(1f)) { onDigit("3") }
        CalcOperatorButton("-", operatorColor, Modifier.weight(1f)) { onOperator("-") }
    }

    Spacer(modifier = Modifier.height(8.dp))

    // Row 4: 0 . = +
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        CalcDigitButton("0", Modifier.weight(1f)) { onDigit("0") }
        CalcDigitButton(".", Modifier.weight(1f)) { onDigit(".") }
        CalcOperatorButton("=", operatorColor, Modifier.weight(1f)) { onEquals() }
        CalcOperatorButton("+", operatorColor, Modifier.weight(1f)) { onOperator("+") }
    }

    Spacer(modifier = Modifier.height(8.dp))

    // Row 5: C ⌫ Insert
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedButton(
            onClick = onClear,
            modifier = Modifier
                .weight(1f)
                .height(52.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text("C", fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        OutlinedButton(
            onClick = onBackspace,
            modifier = Modifier
                .weight(1f)
                .height(52.dp),
            shape = RoundedCornerShape(8.dp)
        ) {
            Text("⌫", fontSize = 18.sp)
        }
        Button(
            onClick = onInsert,
            modifier = Modifier
                .weight(2f)
                .height(52.dp),
            shape = RoundedCornerShape(8.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = operatorColor,
                contentColor = Color.White
            )
        ) {
            Text("Insert", fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CalcDigitButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(8.dp)
    ) {
        Text(label, fontSize = 20.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun CalcOperatorButton(
    label: String,
    color: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Button(
        onClick = onClick,
        modifier = modifier.height(52.dp),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = color,
            contentColor = Color.White
        )
    ) {
        Text(label, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}

// ─── Expression Evaluator ───────────────────────────────────────────────────────

/**
 * Evaluates a mathematical expression string with correct operator precedence.
 * Supports +, -, ×, ÷ with × and ÷ evaluated before + and -.
 *
 * @param expr The expression string (e.g., "5 + 3 × 2")
 * @return The result as a string, or "Error" if the expression is invalid.
 */
internal fun evaluateExpression(expr: String): String {
    if (expr.isBlank()) return ""

    return try {
        val tokens = tokenize(expr)
        if (tokens.isEmpty()) return ""
        val result = parseExpression(tokens)
        // Format: remove trailing .0 for whole numbers
        if (result == result.toLong().toDouble()) {
            result.toLong().toString()
        } else {
            // Round to 10 decimal places to avoid floating point artifacts
            val rounded = Math.round(result * 10_000_000_000.0) / 10_000_000_000.0
            if (rounded == rounded.toLong().toDouble()) {
                rounded.toLong().toString()
            } else {
                rounded.toString()
            }
        }
    } catch (_: Exception) {
        "Error"
    }
}

/**
 * Tokenizes an expression string into numbers and operators.
 */
private fun tokenize(expr: String): List<String> {
    val tokens = mutableListOf<String>()
    val cleaned = expr.trim()
    var i = 0

    while (i < cleaned.length) {
        when {
            cleaned[i].isWhitespace() -> i++
            cleaned[i] in listOf('+', '-', '×', '÷') -> {
                // Handle negative numbers at start or after operator
                if (cleaned[i] == '-' && (tokens.isEmpty() || tokens.last() in listOf("+", "-", "×", "÷"))) {
                    // Negative number
                    val sb = StringBuilder("-")
                    i++
                    while (i < cleaned.length && (cleaned[i].isDigit() || cleaned[i] == '.')) {
                        sb.append(cleaned[i])
                        i++
                    }
                    if (sb.length > 1) {
                        tokens.add(sb.toString())
                    }
                } else {
                    tokens.add(cleaned[i].toString())
                    i++
                }
            }
            cleaned[i].isDigit() || cleaned[i] == '.' -> {
                val sb = StringBuilder()
                while (i < cleaned.length && (cleaned[i].isDigit() || cleaned[i] == '.')) {
                    sb.append(cleaned[i])
                    i++
                }
                tokens.add(sb.toString())
            }
            else -> i++ // Skip unknown characters
        }
    }

    return tokens
}

/**
 * Parses and evaluates an expression with correct operator precedence.
 * Uses a simple two-pass approach:
 * 1. First pass: evaluate × and ÷ (left to right)
 * 2. Second pass: evaluate + and - (left to right)
 */
private fun parseExpression(tokens: List<String>): Double {
    if (tokens.isEmpty()) throw IllegalArgumentException("Empty expression")

    // Convert to mutable lists of numbers and operators
    val numbers = mutableListOf<Double>()
    val operators = mutableListOf<String>()

    var i = 0
    while (i < tokens.size) {
        val token = tokens[i]
        val num = token.toDoubleOrNull()
        if (num != null) {
            numbers.add(num)
        } else if (token in listOf("+", "-", "×", "÷")) {
            operators.add(token)
        }
        i++
    }

    // If we have more numbers than operators + 1, or mismatched, handle gracefully
    // First pass: handle × and ÷
    var j = 0
    while (j < operators.size) {
        if (operators[j] == "×" || operators[j] == "÷") {
            val left = numbers[j]
            val right = numbers[j + 1]
            val result = if (operators[j] == "×") left * right else {
                if (right == 0.0) throw ArithmeticException("Division by zero")
                left / right
            }
            numbers[j] = result
            numbers.removeAt(j + 1)
            operators.removeAt(j)
        } else {
            j++
        }
    }

    // Second pass: handle + and -
    var result = numbers[0]
    for (k in operators.indices) {
        val right = numbers[k + 1]
        result = when (operators[k]) {
            "+" -> result + right
            "-" -> result - right
            else -> result
        }
    }

    return result
}
