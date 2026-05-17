package com.cwoc.app.domain.search

/**
 * Boolean search AST node types.
 */
sealed class SearchNode {
    /** A single search term (case-insensitive substring match). */
    data class Term(val value: String) : SearchNode()

    /** Logical AND: both children must match. */
    data class And(val left: SearchNode, val right: SearchNode) : SearchNode()

    /** Logical OR: at least one child must match. */
    data class Or(val left: SearchNode, val right: SearchNode) : SearchNode()

    /** Logical NOT: child must NOT match. */
    data class Not(val child: SearchNode) : SearchNode()
}

/**
 * Recursive-descent parser for boolean search queries.
 *
 * Supported syntax:
 * - Space-separated terms are implicitly AND'd
 * - `AND` keyword (explicit)
 * - `OR` keyword
 * - `NOT` keyword or `-` prefix for negation
 * - Parentheses for grouping: `(a OR b) AND c`
 * - Quoted strings for exact phrases: `"hello world"`
 *
 * Operator precedence (lowest to highest): OR, AND, NOT, Term/Parens
 *
 * Graceful fallback: unparseable input is treated as a single Term.
 */
class BooleanSearchParser {

    private var tokens: List<String> = emptyList()
    private var pos: Int = 0

    /**
     * Parse a query string into a SearchNode AST.
     * Returns null for empty/blank queries.
     */
    fun parse(query: String): SearchNode? {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) return null

        tokens = tokenize(trimmed)
        if (tokens.isEmpty()) return null

        pos = 0

        return try {
            val result = parseOr()
            result
        } catch (e: Exception) {
            // Graceful fallback: treat entire input as a single term
            SearchNode.Term(trimmed.lowercase())
        }
    }

    // ── Tokenizer ────────────────────────────────────────────────────────────

    private fun tokenize(input: String): List<String> {
        val result = mutableListOf<String>()
        var i = 0

        while (i < input.length) {
            when {
                input[i].isWhitespace() -> i++

                input[i] == '(' -> {
                    result.add("(")
                    i++
                }

                input[i] == ')' -> {
                    result.add(")")
                    i++
                }

                input[i] == '-' && (result.isEmpty() || result.last() in listOf("(", "AND", "OR", "NOT")) -> {
                    // Prefix negation: -term
                    result.add("NOT")
                    i++
                }

                input[i] == '"' -> {
                    // Quoted phrase
                    i++
                    val start = i
                    while (i < input.length && input[i] != '"') i++
                    val phrase = input.substring(start, i).lowercase()
                    if (phrase.isNotEmpty()) result.add(phrase)
                    if (i < input.length) i++ // skip closing quote
                }

                else -> {
                    // Word token
                    val start = i
                    while (i < input.length && !input[i].isWhitespace() && input[i] != '(' && input[i] != ')') i++
                    val word = input.substring(start, i)

                    when (word.uppercase()) {
                        "AND" -> result.add("AND")
                        "OR" -> result.add("OR")
                        "NOT" -> result.add("NOT")
                        else -> result.add(word.lowercase())
                    }
                }
            }
        }

        return result
    }

    // ── Recursive Descent ────────────────────────────────────────────────────

    private fun parseOr(): SearchNode {
        var left = parseAnd()

        while (pos < tokens.size && tokens[pos] == "OR") {
            pos++ // consume OR
            val right = parseAnd()
            left = SearchNode.Or(left, right)
        }

        return left
    }

    private fun parseAnd(): SearchNode {
        var left = parseNot()

        while (pos < tokens.size) {
            val token = tokens[pos]
            // Explicit AND or implicit AND (next token is a term, NOT, or open paren)
            if (token == "AND") {
                pos++ // consume AND
                val right = parseNot()
                left = SearchNode.And(left, right)
            } else if (token != "OR" && token != ")" && token != "AND") {
                // Implicit AND: space-separated terms
                val right = parseNot()
                left = SearchNode.And(left, right)
            } else {
                break
            }
        }

        return left
    }

    private fun parseNot(): SearchNode {
        if (pos < tokens.size && tokens[pos] == "NOT") {
            pos++ // consume NOT
            val child = parseAtom()
            return SearchNode.Not(child)
        }
        return parseAtom()
    }

    private fun parseAtom(): SearchNode {
        if (pos >= tokens.size) {
            throw IllegalStateException("Unexpected end of query")
        }

        val token = tokens[pos]

        if (token == "(") {
            pos++ // consume (
            val inner = parseOr()
            if (pos < tokens.size && tokens[pos] == ")") {
                pos++ // consume )
            }
            return inner
        }

        // It's a term
        pos++
        return SearchNode.Term(token)
    }
}
