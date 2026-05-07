"""Chit search API routes — boolean search expression parser.

Provides the search endpoint and the shared _search_filter_chits() function
used by both global search and admin chit search.
"""

import logging
from typing import Optional

import sqlite3
from fastapi import APIRouter, HTTPException, Query, Request

from src.backend.db import (
    DB_PATH, deserialize_json_field, compute_system_tags,
)
from src.backend.sharing import resolve_effective_role
from src.backend.routes.chits import _enrich_assigned_to_display_names


logger = logging.getLogger(__name__)
router = APIRouter()

def _search_filter_chits(chits_list, query_str):
    """Filter a list of deserialized chit dicts using the boolean search expression parser.

    This is the shared search logic used by both the global search endpoint and
    the admin chit search. Supports #tags, &&, ||, !, parentheses, field:value, and implicit AND.

    Args:
        chits_list: list of chit dicts (already deserialized from DB)
        query_str: the raw search query string

    Returns:
        list of matching chit dicts
    """
    if not query_str or not query_str.strip():
        return chits_list

    query_lower = query_str.strip().lower()

    # Field aliases (same as in search_chits)
    _field_aliases = {
        'title': ['title'],
        'note': ['note'],
        'notes': ['note'],
        'location': ['location'],
        'loc': ['location'],
        'status': ['status'],
        'priority': ['priority'],
        'severity': ['severity'],
        'color': ['color'],
        'people': ['people'],
        'person': ['people'],
        'assigned': ['assigned_to'],
        'assigned_to': ['assigned_to'],
        'checklist': ['checklist'],
        'subject': ['email_subject', 'title'],
        'sender': ['email_from'],
        'from': ['email_from'],
        'to': ['email_to'],
        'cc': ['email_cc'],
        'bcc': ['email_bcc'],
        'body': ['email_body_text', 'note'],
        'child': ['_child_titles'],
        'start': ['start_datetime'],
        'end': ['end_datetime'],
        'due': ['due_datetime'],
        'created': ['created_datetime'],
        'modified': ['modified_datetime'],
    }

    def _tokenize_search(q_str):
        tokens = []
        i = 0
        while i < len(q_str):
            if q_str[i] in ' \t':
                i += 1
            elif q_str[i] == '(':
                tokens.append(('OP', '('))
                i += 1
            elif q_str[i] == ')':
                tokens.append(('OP', ')'))
                i += 1
            elif q_str[i:i+2] == '&&':
                tokens.append(('OP', '&&'))
                i += 2
            elif q_str[i:i+2] == '||':
                tokens.append(('OP', '||'))
                i += 2
            elif q_str[i] == '!' and i + 1 < len(q_str) and q_str[i+1] in '#(':
                tokens.append(('OP', '!'))
                i += 1
            elif q_str[i] == '!':
                i += 1
                while i < len(q_str) and q_str[i] in ' \t':
                    i += 1
                if i < len(q_str) and q_str[i] == '(':
                    tokens.append(('OP', '!'))
                elif i < len(q_str) and q_str[i] not in '()&|':
                    j = i
                    while j < len(q_str) and q_str[j] not in ' \t()&|':
                        j += 1
                    tokens.append(('OP', '!'))
                    tokens.append(('TEXT', q_str[i:j]))
                    i = j
                else:
                    tokens.append(('OP', '!'))
            elif q_str[i] == '#':
                j = i + 1
                while j < len(q_str) and q_str[j] not in ' \t()&|!':
                    j += 1
                if j > i + 1:
                    tokens.append(('TAG', q_str[i+1:j]))
                i = j
            else:
                j = i
                while j < len(q_str) and q_str[j] not in ' \t()&|!#':
                    j += 1
                word = q_str[i:j]
                # Check for field:value syntax
                colon_pos = word.find(':')
                if colon_pos > 0:
                    field_name = word[:colon_pos]
                    if field_name in _field_aliases:
                        i += colon_pos + 1
                        while i < len(q_str) and q_str[i] in ' \t':
                            i += 1
                        if i < len(q_str) and q_str[i] == '(':
                            i += 1
                            val_start = i
                            depth = 1
                            while i < len(q_str) and depth > 0:
                                if q_str[i] == '(':
                                    depth += 1
                                elif q_str[i] == ')':
                                    depth -= 1
                                i += 1
                            field_value = q_str[val_start:i - 1].strip()
                        else:
                            val_start = i
                            while i < len(q_str) and q_str[i] not in ' \t()&|!#':
                                i += 1
                            field_value = q_str[val_start:i]
                        if field_value:
                            tokens.append(('FIELD', (field_name, field_value)))
                        continue
                if j > i:
                    tokens.append(('TEXT', word))
                i = j
        return tokens

    def _parse_search_ast(tokens):
        pos = [0]
        def peek():
            return tokens[pos[0]] if pos[0] < len(tokens) else None
        def consume():
            t = tokens[pos[0]] if pos[0] < len(tokens) else None
            pos[0] += 1
            return t
        def parse_expr():
            left = parse_and_expr()
            while peek() and peek() == ('OP', '||'):
                consume()
                right = parse_and_expr()
                left = ('or', left, right)
            return left
        def parse_and_expr():
            left = parse_unary()
            while True:
                p = peek()
                if p and p == ('OP', '&&'):
                    consume()
                    right = parse_unary()
                    left = ('and', left, right)
                elif p and p not in (('OP', '||'), ('OP', ')')):
                    right = parse_unary()
                    left = ('and', left, right)
                else:
                    break
            return left
        def parse_unary():
            if peek() == ('OP', '!'):
                consume()
                operand = parse_unary()
                return ('not', operand)
            return parse_atom()
        def parse_atom():
            p = peek()
            if p == ('OP', '('):
                consume()
                node = parse_expr()
                if peek() == ('OP', ')'):
                    consume()
                return node
            t = consume()
            if t is None:
                return ('text', '')
            if t[0] == 'TAG':
                return ('tag', t[1])
            if t[0] == 'TEXT':
                return ('text', t[1])
            if t[0] == 'FIELD':
                return ('field', t[1][0], t[1][1])
            return ('text', '')
        if not tokens:
            return None
        return parse_expr()

    def _tag_matches_token(token, tag_list):
        for t in tag_list:
            if t == token or t.startswith(token + '/'):
                return True
            segments = t.split('/')
            if token in segments:
                return True
        return False

    def _text_matches(term, searchable_text):
        return term in searchable_text

    def _get_field_text(chit, field_name):
        """Get the lowercase text content of a specific field."""
        value = chit.get(field_name)
        if value is None:
            return ''
        if isinstance(value, list):
            parts = []
            for item in value:
                if isinstance(item, dict):
                    text = item.get('text', '')
                    if text:
                        parts.append(str(text).lower())
                elif isinstance(item, str):
                    parts.append(item.lower())
            return ' '.join(parts)
        return str(value).lower()

    def _field_matches(field_alias, search_value, chit):
        """Check if search_value appears in the specified field(s)."""
        if not chit:
            return False
        target_fields = _field_aliases.get(field_alias, [field_alias])
        for field_name in target_fields:
            if field_name == '_child_titles':
                # Special case: search child chit titles
                child_ids = chit.get('child_chits')
                if child_ids and isinstance(child_ids, list):
                    try:
                        child_conn = sqlite3.connect(DB_PATH)
                        child_cursor = child_conn.cursor()
                        placeholders = ','.join('?' * len(child_ids))
                        child_cursor.execute(
                            f"SELECT title FROM chits WHERE id IN ({placeholders}) AND (deleted = 0 OR deleted IS NULL)",
                            child_ids
                        )
                        for (child_title,) in child_cursor.fetchall():
                            if child_title and search_value in child_title.lower():
                                child_conn.close()
                                return True
                        child_conn.close()
                    except Exception:
                        pass
            else:
                field_text = _get_field_text(chit, field_name)
                if field_text and search_value in field_text:
                    return True
        return False

    def _eval_search_ast(node, tag_list_lower, searchable_text, chit=None):
        if node is None:
            return True
        kind = node[0]
        if kind == 'tag':
            return _tag_matches_token(node[1], tag_list_lower)
        elif kind == 'text':
            return _text_matches(node[1], searchable_text)
        elif kind == 'field':
            return _field_matches(node[1], node[2], chit)
        elif kind == 'and':
            return _eval_search_ast(node[1], tag_list_lower, searchable_text, chit) and \
                   _eval_search_ast(node[2], tag_list_lower, searchable_text, chit)
        elif kind == 'or':
            return _eval_search_ast(node[1], tag_list_lower, searchable_text, chit) or \
                   _eval_search_ast(node[2], tag_list_lower, searchable_text, chit)
        elif kind == 'not':
            return not _eval_search_ast(node[1], tag_list_lower, searchable_text, chit)
        return True

    def _get_searchable_text(chit):
        parts = []
        for field_name in [
            "title", "note", "status", "priority", "severity",
            "location", "color", "id",
            "start_datetime", "end_datetime", "due_datetime",
            "created_datetime", "modified_datetime",
            "email_from", "email_subject", "email_body_text",
        ]:
            v = chit.get(field_name)
            if v:
                parts.append(str(v).lower())
        people = chit.get("people")
        if people and isinstance(people, list):
            parts.extend(str(p).lower() for p in people if p)
        checklist = chit.get("checklist")
        if checklist and isinstance(checklist, list):
            for item in checklist:
                if isinstance(item, dict) and item.get("text"):
                    parts.append(str(item["text"]).lower())
        tags = chit.get("tags")
        if tags and isinstance(tags, list):
            parts.extend(str(t).lower() for t in tags if t)
        return ' '.join(parts)

    # Parse and evaluate
    search_tokens = _tokenize_search(query_lower)
    search_ast = _parse_search_ast(search_tokens)
    if search_ast is None:
        return chits_list

    results = []
    for chit in chits_list:
        tags = chit.get("tags")
        tag_list_lower = [t.lower() for t in tags] if tags and isinstance(tags, list) else []
        searchable_text = _get_searchable_text(chit)
        if _eval_search_ast(search_ast, tag_list_lower, searchable_text, chit):
            results.append(chit)

    return results


@router.get("/api/chits/search")
def search_chits(request: Request, q: Optional[str] = Query(None)):
    """Global search across all chit fields. Returns matching chits with matched field names.

    Uses FTS5 full-text search when available for relevance-ranked results,
    falling back to LIKE-based search if FTS5 is not available.
    """
    if not q or not q.strip():
        return []

    query_str = q.strip()
    query_lower = query_str.lower()

    # ── Unified boolean search expression parser ──────────────────────────────
    # Supports full boolean logic on BOTH #tags and text terms:
    #   #work && #urgent         → must have both tags
    #   #work || #personal       → either tag
    #   !#done                   → must NOT have tag
    #   meeting || lunch         → text contains either word
    #   el !hello                → contains "el" AND does NOT contain "hello"
    #   !(hello)                 → does NOT contain "hello"
    #   (#work || #personal) && !#done && meeting  → complex
    #   Multiple terms without operators default to AND
    #   #parent matches sub-tags (parent/child, etc.)

    # ── Field-scoped search support ─────────────────────────────────────────
    # Recognized field prefixes for field:value syntax.
    # Maps user-facing aliases to internal field names (or lists for multi-field aliases).
    _FIELD_ALIASES = {
        'title': ['title'],
        'note': ['note'],
        'notes': ['note'],
        'location': ['location'],
        'loc': ['location'],
        'status': ['status'],
        'priority': ['priority'],
        'severity': ['severity'],
        'color': ['color'],
        'people': ['people'],
        'person': ['people'],
        'assigned': ['assigned_to'],
        'assigned_to': ['assigned_to'],
        'checklist': ['checklist'],
        'subject': ['email_subject', 'title'],
        'sender': ['email_from'],
        'from': ['email_from'],
        'to': ['email_to'],
        'cc': ['email_cc'],
        'bcc': ['email_bcc'],
        'body': ['email_body_text', 'note'],
        'child': ['_child_titles'],  # special: searches child chit titles
        'start': ['start_datetime'],
        'end': ['end_datetime'],
        'due': ['due_datetime'],
        'created': ['created_datetime'],
        'modified': ['modified_datetime'],
    }

    def _tokenize_search(q_str):
        """Tokenize search query into operators, #tags, field:value, and text terms."""
        tokens = []
        i = 0
        while i < len(q_str):
            # Skip whitespace
            if q_str[i] in ' \t':
                i += 1
            elif q_str[i] == '(':
                tokens.append(('OP', '('))
                i += 1
            elif q_str[i] == ')':
                tokens.append(('OP', ')'))
                i += 1
            elif q_str[i:i+2] == '&&':
                tokens.append(('OP', '&&'))
                i += 2
            elif q_str[i:i+2] == '||':
                tokens.append(('OP', '||'))
                i += 2
            elif q_str[i] == '!' and i + 1 < len(q_str) and q_str[i+1] in '#(':
                # NOT operator before a tag or group
                tokens.append(('OP', '!'))
                i += 1
            elif q_str[i] == '!':
                # NOT operator before a text term — look ahead for the word
                i += 1
                # Skip whitespace after !
                while i < len(q_str) and q_str[i] in ' \t':
                    i += 1
                if i < len(q_str) and q_str[i] == '(':
                    # !(expr) — insert NOT then let ( be parsed next
                    tokens.append(('OP', '!'))
                elif i < len(q_str) and q_str[i] not in '()&|':
                    # !word — read the word and wrap as NOT + TEXT
                    j = i
                    while j < len(q_str) and q_str[j] not in ' \t()&|':
                        j += 1
                    tokens.append(('OP', '!'))
                    tokens.append(('TEXT', q_str[i:j]))
                    i = j
                else:
                    tokens.append(('OP', '!'))
            elif q_str[i] == '#':
                # Tag token
                j = i + 1
                while j < len(q_str) and q_str[j] not in ' \t()&|!':
                    j += 1
                if j > i + 1:
                    tokens.append(('TAG', q_str[i+1:j]))
                i = j
            else:
                # Text term — read until operator or whitespace
                # But first check for field:value syntax
                j = i
                while j < len(q_str) and q_str[j] not in ' \t()&|!#':
                    j += 1
                word = q_str[i:j]

                # Check if this is a field:value or field:(multi word) token
                colon_pos = word.find(':')
                if colon_pos > 0:
                    field_name = word[:colon_pos]
                    if field_name in _FIELD_ALIASES:
                        # It's a recognized field prefix
                        i += colon_pos + 1  # advance past "field:"
                        # Read the value — either (parenthesized multi-word) or single word
                        while i < len(q_str) and q_str[i] in ' \t':
                            i += 1
                        if i < len(q_str) and q_str[i] == '(':
                            # Parenthesized value: field:(multi word value)
                            i += 1  # skip (
                            val_start = i
                            depth = 1
                            while i < len(q_str) and depth > 0:
                                if q_str[i] == '(':
                                    depth += 1
                                elif q_str[i] == ')':
                                    depth -= 1
                                i += 1
                            field_value = q_str[val_start:i - 1].strip()
                        else:
                            # Single word value
                            val_start = i
                            while i < len(q_str) and q_str[i] not in ' \t()&|!#':
                                i += 1
                            field_value = q_str[val_start:i]
                        if field_value:
                            tokens.append(('FIELD', (field_name, field_value)))
                        continue

                # Regular text term
                if j > i:
                    tokens.append(('TEXT', word))
                i = j
        return tokens

    def _parse_search_ast(tokens):
        """Parse tokenized search into an AST.
        Grammar:
            expr     → and_expr ( '||' and_expr )*
            and_expr → unary ( ('&&' | implicit) unary )*
            unary    → '!' unary | atom
            atom     → '(' expr ')' | TAG | TEXT
        Implicit AND: adjacent terms without operator.
        """
        pos = [0]

        def peek():
            return tokens[pos[0]] if pos[0] < len(tokens) else None

        def consume():
            t = tokens[pos[0]] if pos[0] < len(tokens) else None
            pos[0] += 1
            return t

        def parse_expr():
            left = parse_and_expr()
            while peek() and peek() == ('OP', '||'):
                consume()  # eat ||
                right = parse_and_expr()
                left = ('or', left, right)
            return left

        def parse_and_expr():
            left = parse_unary()
            while True:
                p = peek()
                if p and p == ('OP', '&&'):
                    consume()  # eat &&
                    right = parse_unary()
                    left = ('and', left, right)
                elif p and p not in (('OP', '||'), ('OP', ')')):
                    # Implicit AND
                    right = parse_unary()
                    left = ('and', left, right)
                else:
                    break
            return left

        def parse_unary():
            if peek() == ('OP', '!'):
                consume()  # eat !
                operand = parse_unary()
                return ('not', operand)
            return parse_atom()

        def parse_atom():
            p = peek()
            if p == ('OP', '('):
                consume()  # eat (
                node = parse_expr()
                if peek() == ('OP', ')'):
                    consume()  # eat )
                return node
            t = consume()
            if t is None:
                return ('text', '')
            if t[0] == 'TAG':
                return ('tag', t[1])
            if t[0] == 'TEXT':
                return ('text', t[1])
            if t[0] == 'FIELD':
                # t[1] is (field_name, field_value)
                return ('field', t[1][0], t[1][1])
            # Shouldn't reach here, but fallback
            return ('text', '')

        if not tokens:
            return None
        result = parse_expr()
        return result

    def _tag_matches_token(token, tag_list):
        """Check if any tag in the list matches the token (with hierarchy).
        Excludes system tags (cwoc_system/) from matching."""
        for t in tag_list:
            if t.startswith('cwoc_system/'):
                continue
            if t == token or t.startswith(token + '/'):
                return True
            segments = t.split('/')
            if token in segments:
                return True
        return False

    def _text_matches(term, searchable_text):
        """Check if a text term appears in the chit's searchable text."""
        return term in searchable_text

    def _field_matches(field_alias, search_value, chit):
        """Check if search_value appears in the specified field(s) of the chit."""
        if not chit:
            return False
        target_fields = _FIELD_ALIASES.get(field_alias, [field_alias])
        for field_name in target_fields:
            if field_name == '_child_titles':
                # Special case: search child chit titles
                if _child_title_matches(search_value, chit):
                    return True
            else:
                field_text = _get_field_text(chit, field_name)
                if field_text and search_value in field_text:
                    return True
        return False

    def _get_field_text(chit, field_name):
        """Get the lowercase text content of a specific field for matching."""
        value = chit.get(field_name)
        if value is None:
            return ''
        if isinstance(value, list):
            # Handle list fields (people, email_to, email_cc, email_bcc, checklist)
            parts = []
            for item in value:
                if isinstance(item, dict):
                    # Checklist items
                    text = item.get('text', '')
                    if text:
                        parts.append(str(text).lower())
                elif isinstance(item, str):
                    parts.append(item.lower())
            return ' '.join(parts)
        return str(value).lower()

    def _child_title_matches(search_value, chit):
        """Check if any child chit has a title matching the search value."""
        child_ids = chit.get('child_chits')
        if not child_ids or not isinstance(child_ids, list) or not child_ids:
            return False
        # Look up child chit titles from the already-fetched results
        # We need to query the DB for child titles
        try:
            child_conn = sqlite3.connect(DB_PATH)
            child_cursor = child_conn.cursor()
            placeholders = ','.join('?' * len(child_ids))
            child_cursor.execute(
                f"SELECT title FROM chits WHERE id IN ({placeholders}) AND (deleted = 0 OR deleted IS NULL)",
                child_ids
            )
            for (child_title,) in child_cursor.fetchall():
                if child_title and search_value in child_title.lower():
                    child_conn.close()
                    return True
            child_conn.close()
        except Exception:
            pass
        return False

    def _eval_search_ast(node, tag_list_lower, searchable_text, chit=None):
        """Evaluate a search AST against a chit's tags and text content."""
        if node is None:
            return True
        kind = node[0]
        if kind == 'tag':
            return _tag_matches_token(node[1], tag_list_lower)
        elif kind == 'text':
            return _text_matches(node[1], searchable_text)
        elif kind == 'field':
            # node is ('field', field_alias, search_value)
            field_alias = node[1]
            search_value = node[2]
            return _field_matches(field_alias, search_value, chit)
        elif kind == 'and':
            return _eval_search_ast(node[1], tag_list_lower, searchable_text, chit) and \
                   _eval_search_ast(node[2], tag_list_lower, searchable_text, chit)
        elif kind == 'or':
            return _eval_search_ast(node[1], tag_list_lower, searchable_text, chit) or \
                   _eval_search_ast(node[2], tag_list_lower, searchable_text, chit)
        elif kind == 'not':
            return not _eval_search_ast(node[1], tag_list_lower, searchable_text, chit)
        return True

    def _get_searchable_text(chit):
        """Build a single lowercase string of all searchable text fields."""
        parts = []
        for field_name in [
            "title", "note", "status", "priority", "severity",
            "location", "color",
            "start_datetime", "end_datetime", "due_datetime",
            "created_datetime", "modified_datetime",
            "email_from", "email_subject", "email_body_text",
        ]:
            v = chit.get(field_name)
            if v:
                parts.append(str(v).lower())
        # People
        people = chit.get("people")
        if people and isinstance(people, list):
            parts.extend(str(p).lower() for p in people if p)
        # Checklist items
        checklist = chit.get("checklist")
        if checklist and isinstance(checklist, list):
            for item in checklist:
                if isinstance(item, dict) and item.get("text"):
                    parts.append(str(item["text"]).lower())
        # Alerts
        alerts = chit.get("alerts")
        if alerts and isinstance(alerts, list):
            for alert in alerts:
                if isinstance(alert, dict):
                    for k in ["description", "label", "name", "type"]:
                        v = alert.get(k)
                        if v:
                            parts.append(str(v).lower())
        # Tags as text (so text search can find tag names too — exclude system tags)
        tags = chit.get("tags")
        if tags and isinstance(tags, list):
            parts.extend(str(t).lower() for t in tags if t and not str(t).startswith("CWOC_System/"))
        return ' '.join(parts)

    def _collect_matched_fields(chit, search_ast):
        """Determine which fields matched for display purposes."""
        matched = []
        text_terms = _collect_positive_text_terms(search_ast)
        tag_terms = _collect_positive_tag_terms(search_ast)
        field_terms = _collect_field_terms(search_ast)

        if tag_terms:
            tags = chit.get("tags")
            tag_list_lower = [t.lower() for t in tags] if tags and isinstance(tags, list) else []
            for token in tag_terms:
                if _tag_matches_token(token, tag_list_lower):
                    if "tags" not in matched:
                        matched.append("tags")
                    break

        # Add matched fields from field-scoped searches
        if field_terms:
            for field_alias, search_value in field_terms:
                target_fields = _FIELD_ALIASES.get(field_alias, [field_alias])
                for field_name in target_fields:
                    if field_name == '_child_titles':
                        if 'child_chits' not in matched:
                            matched.append('child_chits')
                    elif field_name not in matched:
                        matched.append(field_name)

        if text_terms:
            for field_name in [
                "title", "note", "status", "priority", "severity",
                "location", "color",
                "start_datetime", "end_datetime", "due_datetime",
                "created_datetime", "modified_datetime",
                "email_from", "email_subject", "email_body_text",
            ]:
                value = chit.get(field_name)
                if value:
                    val_lower = str(value).lower()
                    if any(t in val_lower for t in text_terms):
                        matched.append(field_name)

            people = chit.get("people")
            if people and isinstance(people, list):
                for person in people:
                    if isinstance(person, str) and any(t in person.lower() for t in text_terms):
                        matched.append("people")
                        break

            checklist = chit.get("checklist")
            if checklist and isinstance(checklist, list):
                for item in checklist:
                    if isinstance(item, dict):
                        item_text = item.get("text", "")
                        if item_text and any(t in str(item_text).lower() for t in text_terms):
                            matched.append("checklist")
                            break

            alerts = chit.get("alerts")
            if alerts and isinstance(alerts, list):
                for alert in alerts:
                    if isinstance(alert, dict):
                        for alert_key in ["description", "label", "name", "type"]:
                            alert_val = alert.get(alert_key, "")
                            if alert_val and any(t in str(alert_val).lower() for t in text_terms):
                                matched.append("alerts")
                                break
                        if "alerts" in matched:
                            break

        return matched if matched else ["full_text"]

    def _collect_positive_text_terms(node):
        """Collect all non-negated text terms from the AST for highlighting."""
        if node is None:
            return []
        kind = node[0]
        if kind == 'text':
            return [node[1]]
        elif kind == 'field':
            # Include the field value as a highlight term
            return [node[2]]
        elif kind == 'and':
            return _collect_positive_text_terms(node[1]) + _collect_positive_text_terms(node[2])
        elif kind == 'or':
            return _collect_positive_text_terms(node[1]) + _collect_positive_text_terms(node[2])
        elif kind == 'not':
            return []  # Don't include negated terms
        return []

    def _collect_positive_tag_terms(node):
        """Collect all non-negated tag terms from the AST."""
        if node is None:
            return []
        kind = node[0]
        if kind == 'tag':
            return [node[1]]
        elif kind == 'and':
            return _collect_positive_tag_terms(node[1]) + _collect_positive_tag_terms(node[2])
        elif kind == 'or':
            return _collect_positive_tag_terms(node[1]) + _collect_positive_tag_terms(node[2])
        elif kind == 'not':
            return []  # Don't include negated terms
        return []

    def _collect_field_terms(node):
        """Collect all non-negated field search terms from the AST."""
        if node is None:
            return []
        kind = node[0]
        if kind == 'field':
            return [(node[1], node[2])]  # (field_alias, value)
        elif kind == 'and':
            return _collect_field_terms(node[1]) + _collect_field_terms(node[2])
        elif kind == 'or':
            return _collect_field_terms(node[1]) + _collect_field_terms(node[2])
        elif kind == 'not':
            return []
        return []

    # Parse the query into a unified AST
    search_tokens = _tokenize_search(query_lower)
    search_ast = _parse_search_ast(search_tokens)
    has_search_expr = search_ast is not None

    conn = None
    try:
        user_id = request.state.user_id
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Fetch all non-deleted chits for this user
        cursor.execute("SELECT * FROM chits WHERE (deleted = 0 OR deleted IS NULL) AND owner_id = ?", (user_id,))
        results = []
        seen_ids = set()

        for row in cursor.fetchall():
            chit = dict(zip([col[0] for col in cursor.description], row))
            # Deserialize JSON fields
            chit["tags"] = deserialize_json_field(chit["tags"])
            chit["checklist"] = deserialize_json_field(chit["checklist"])
            chit["people"] = deserialize_json_field(chit["people"])
            chit["child_chits"] = deserialize_json_field(chit.get("child_chits"))
            chit["is_project_master"] = bool(chit.get("is_project_master"))
            chit["all_day"] = bool(chit.get("all_day"))
            chit["pinned"] = bool(chit.get("pinned"))
            chit["archived"] = bool(chit.get("archived"))
            chit["alerts"] = deserialize_json_field(chit.get("alerts"))
            chit["recurrence_rule"] = deserialize_json_field(chit.get("recurrence_rule"))
            chit["recurrence_exceptions"] = deserialize_json_field(chit.get("recurrence_exceptions"))
            chit["weather_data"] = deserialize_json_field(chit.get("weather_data"))
            chit["health_data"] = deserialize_json_field(chit.get("health_data"))
            chit["habit"] = bool(chit.get("habit"))
            chit["habit_goal"] = int(chit.get("habit_goal") or 1)
            chit["habit_success"] = int(chit.get("habit_success") or 0)
            chit["show_on_calendar"] = bool(chit.get("show_on_calendar", 1))
            chit["habit_reset_period"] = chit.get("habit_reset_period")
            chit["habit_last_action_date"] = chit.get("habit_last_action_date")
            chit["habit_hide_overall"] = bool(chit.get("habit_hide_overall"))
            chit["perpetual"] = bool(chit.get("perpetual"))
            chit["shares"] = deserialize_json_field(chit.get("shares"))
            chit["stealth"] = bool(chit.get("stealth"))
            chit["assigned_to"] = chit.get("assigned_to")
            # Email fields
            chit["email_to"] = deserialize_json_field(chit.get("email_to"))
            chit["email_cc"] = deserialize_json_field(chit.get("email_cc"))
            chit["email_bcc"] = deserialize_json_field(chit.get("email_bcc"))
            chit["email_read"] = bool(chit.get("email_read")) if chit.get("email_read") is not None else None

            matched_fields = []

            # Evaluate the unified boolean search expression
            if has_search_expr:
                tags = chit.get("tags")
                tag_list_lower = [t.lower() for t in tags] if tags and isinstance(tags, list) else []
                searchable_text = _get_searchable_text(chit)

                if not _eval_search_ast(search_ast, tag_list_lower, searchable_text, chit):
                    continue

                matched_fields = _collect_matched_fields(chit, search_ast)

            # Include this chit in results (deduplicate by ID)
            if matched_fields and chit["id"] not in seen_ids:
                seen_ids.add(chit["id"])
                results.append({"chit": chit, "matched_fields": matched_fields})

        # Enrich with assigned_to_display_name
        _enrich_assigned_to_display_names(cursor, [r["chit"] for r in results])

        # Also search contact birthday/anniversary entries
        try:
            cursor.execute(
                """SELECT id, given_name, surname, display_name, dates, color, image_url
                   FROM contacts
                   WHERE (owner_id = ? OR shared_to_vault = 1)""",
                (user_id,),
            )
            contact_cols = [col[0] for col in cursor.description]
            from datetime import date as date_type
            today = date_type.today()
            years = [today.year - 1, today.year, today.year + 1]

            for crow in cursor.fetchall():
                contact = dict(zip(contact_cols, crow))
                dates_raw = deserialize_json_field(contact.get("dates"))
                if not dates_raw or not isinstance(dates_raw, list):
                    continue
                display_name = contact.get("display_name") or contact.get("given_name") or "Unknown"
                contact_color = contact.get("color")
                contact_id = contact["id"]
                image_url = contact.get("image_url")

                for date_entry in dates_raw:
                    if not isinstance(date_entry, dict):
                        continue
                    if date_entry.get("show_on_calendar") is False:
                        continue
                    label = date_entry.get("label", "")
                    value = date_entry.get("value", "")
                    if not value:
                        continue
                    # Check if query matches display_name or label
                    if query_lower not in display_name.lower() and query_lower not in label.lower():
                        continue
                    # Generate entries for relevant years
                    try:
                        parts = value.split("-")
                        orig_year = int(parts[0])
                        month = int(parts[1])
                        day_num = int(parts[2])
                    except (ValueError, IndexError):
                        continue
                    for year in years:
                        try:
                            event_date = date_type(year, month, day_num)
                        except ValueError:
                            if month == 2 and day_num == 29:
                                event_date = date_type(year, 2, 28)
                            else:
                                continue
                        age_str = ""
                        if orig_year and orig_year > 1900 and orig_year < year:
                            age_str = f" ({year - orig_year} yrs)"
                        event_id = f"birthday_{contact_id}_{label}_{event_date.isoformat()}"
                        title = f"🎂 {display_name} — {label}{age_str}" if label else f"🎂 {display_name}{age_str}"
                        birthday_chit = {
                            "id": event_id,
                            "title": title,
                            "start_datetime": event_date.isoformat() + "T00:00:00",
                            "end_datetime": event_date.isoformat() + "T23:59:59",
                            "all_day": True,
                            "color": contact_color or "#f5e6d3",
                            "tags": ["Calendar"],
                            "status": None,
                            "people": [display_name],
                            "note": None,
                            "pinned": False,
                            "archived": False,
                            "deleted": False,
                            "checklist": None,
                            "alerts": None,
                            "recurrence_rule": None,
                            "recurrence_exceptions": None,
                            "is_project_master": False,
                            "child_chits": None,
                            "priority": None,
                            "severity": None,
                            "location": None,
                            "_is_birthday": True,
                            "_contact_id": contact_id,
                            "_contact_image_url": image_url,
                            "_date_label": label,
                        }
                        results.append({"chit": birthday_chit, "matched_fields": ["birthday"]})
        except Exception as bday_err:
            logger.debug(f"Birthday search failed (non-fatal): {bday_err}")

        return results
    except Exception as e:
        logger.error(f"Error searching chits: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to search chits: {str(e)}")
    finally:
        if conn:
            conn.close()


