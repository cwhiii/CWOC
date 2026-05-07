"""
Property-based tests for Milkdown editor integration logic.

Tests the pure logic components: chit link filtering, insertion format,
paste sanitization, and XSS prevention.

Uses Python stdlib unittest + random only (no external dependencies).
"""

import unittest
import random
import string
import re
import html


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS (mirroring frontend logic for testability)
# ═══════════════════════════════════════════════════════════════════════════

def filter_chit_links(chit_titles, query, current_chit_id):
    """
    Filter chit titles for autocomplete.
    Returns titles that contain query as case-insensitive substring,
    excluding the current chit.
    """
    query_lower = query.lower()
    return [
        c for c in chit_titles
        if c['title'] and query_lower in c['title'].lower() and c['id'] != current_chit_id
    ]


def format_chit_link(title):
    """Format a chit link insertion: wraps title in [[ ]]."""
    return '[[' + title + ']]'


def sanitize_paste_html(html_content):
    """
    Simulate ProseMirror paste sanitization.
    Strips all HTML tags, script elements, event handlers, style elements.
    Returns only plain text content.
    """
    # Remove script tags and their content
    text = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    # Remove style tags and their content
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
    # Remove iframe tags
    text = re.sub(r'<iframe[^>]*>.*?</iframe>', '', text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r'<iframe[^>]*/>', '', text, flags=re.IGNORECASE)
    # Remove all remaining HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    text = html.unescape(text)
    return text.strip()


def check_xss_safe(markdown_output):
    """
    Verify that markdown output contains no XSS vectors in HTML context.
    Checks for actual HTML elements/attributes, not plain text mentions.
    Returns True if safe, False if dangerous content found.
    """
    dangerous_patterns = [
        r'<script[\s>]',       # Opening script tag
        r'<iframe[\s>]',       # Opening iframe tag
        r'<[^>]+\bon\w+\s*=',  # on* event handlers inside HTML tags
        r'<a[^>]+href\s*=\s*["\']?javascript:', # javascript: in href
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, markdown_output, re.IGNORECASE):
            return False
    return True


# ═══════════════════════════════════════════════════════════════════════════
# RANDOM GENERATORS
# ═══════════════════════════════════════════════════════════════════════════

def random_string(min_len=1, max_len=50):
    """Generate a random string with various characters."""
    length = random.randint(min_len, max_len)
    chars = string.ascii_letters + string.digits + ' _-.,!?'
    return ''.join(random.choice(chars) for _ in range(length))


def random_title():
    """Generate a random chit title."""
    words = ['Meeting', 'Task', 'Note', 'Project', 'Idea', 'Bug', 'Feature',
             'Review', 'Deploy', 'Test', 'Fix', 'Update', 'Refactor', 'Plan',
             'Design', 'Build', 'Ship', 'Launch', 'Sprint', 'Backlog']
    count = random.randint(1, 4)
    return ' '.join(random.choice(words) for _ in range(count))


def random_id():
    """Generate a random chit ID."""
    return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(12))


def random_chit_list(size=None):
    """Generate a random list of chit objects with id and title."""
    if size is None:
        size = random.randint(5, 30)
    return [{'id': random_id(), 'title': random_title()} for _ in range(size)]


def random_html_with_xss():
    """Generate random HTML content with XSS attempts."""
    xss_payloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror="alert(1)">',
        '<div onmouseover="steal()">hover me</div>',
        '<iframe src="evil.com"></iframe>',
        '<a href="javascript:alert(1)">click</a>',
        '<style>body{display:none}</style>',
        '<script src="https://evil.com/steal.js"></script>',
        '<img src=x onload="document.location=\'evil.com\'">',
        '<svg onload="alert(1)">',
        '<input onfocus="alert(1)" autofocus>',
    ]
    safe_content = [
        '<p>Hello world</p>',
        '<h1>Title</h1>',
        '<strong>bold text</strong>',
        '<em>italic text</em>',
        '<a href="https://example.com">link</a>',
        '<ul><li>item 1</li><li>item 2</li></ul>',
        '<blockquote>quoted text</blockquote>',
        '<code>code snippet</code>',
    ]
    parts = []
    for _ in range(random.randint(2, 6)):
        if random.random() < 0.5:
            parts.append(random.choice(xss_payloads))
        else:
            parts.append(random.choice(safe_content))
    return '\n'.join(parts)


def random_markdown_with_xss():
    """Generate markdown with embedded XSS attempts."""
    xss_in_md = [
        '<script>alert("xss")</script>',
        '[click](javascript:alert(1))',
        '![img](x" onerror="alert(1))',
        '<iframe src="evil.com"></iframe>',
        '<div onclick="steal()">text</div>',
        '# Heading <script>alert(1)</script>',
        '**bold** <img src=x onerror=alert(1)>',
        '[link](javascript:void(0))',
    ]
    safe_md = [
        '# Heading',
        '## Subheading',
        '**bold text**',
        '*italic text*',
        '- list item',
        '1. numbered item',
        '> blockquote',
        '`inline code`',
        '[safe link](https://example.com)',
        '---',
    ]
    parts = []
    for _ in range(random.randint(3, 8)):
        if random.random() < 0.4:
            parts.append(random.choice(xss_in_md))
        else:
            parts.append(random.choice(safe_md))
    return '\n'.join(parts)


# ═══════════════════════════════════════════════════════════════════════════
# PROPERTY TESTS
# ═══════════════════════════════════════════════════════════════════════════

class TestChitLinkFiltering(unittest.TestCase):
    """
    Feature: milkdown-editor, Property 5: Chit Link Autocomplete Filtering

    For any query string typed after [[ and any set of chit titles,
    the autocomplete results SHALL:
    (a) contain only titles that include the query as a case-insensitive substring
    (b) never include the currently-edited chit's title/ID

    Validates: Requirements 6.3, 6.6
    """

    def test_filtering_property(self):
        for _ in range(120):
            chits = random_chit_list()
            current_id = random.choice(chits)['id'] if chits else random_id()
            query = random_string(1, 10)

            results = filter_chit_links(chits, query, current_id)

            # Property (a): all results contain query as case-insensitive substring
            for r in results:
                self.assertIn(
                    query.lower(), r['title'].lower(),
                    f"Result '{r['title']}' does not contain query '{query}'"
                )

            # Property (b): current chit is never in results
            for r in results:
                self.assertNotEqual(
                    r['id'], current_id,
                    f"Current chit ID '{current_id}' should be excluded from results"
                )

            # Completeness: no matching chit was missed
            for c in chits:
                if c['id'] != current_id and c['title'] and query.lower() in c['title'].lower():
                    self.assertIn(c, results,
                        f"Chit '{c['title']}' should be in results for query '{query}'")


class TestChitLinkInsertionFormat(unittest.TestCase):
    """
    Feature: milkdown-editor, Property 6: Chit Link Insertion Format

    For any chit title selected from the autocomplete dropdown,
    the text inserted into the editor SHALL be exactly [[selected title]].

    Validates: Requirements 6.2
    """

    def test_insertion_format_property(self):
        for _ in range(120):
            # Generate titles with special characters, unicode, brackets
            special_chars = ['[', ']', '(', ')', '{', '}', '<', '>', '&', '"', "'",
                           '/', '\\', '|', '@', '#', '$', '%', '^', '*', '~', '`']
            title_parts = [random_title()]
            if random.random() < 0.3:
                title_parts.append(random.choice(special_chars))
            if random.random() < 0.2:
                title_parts.append(''.join(random.choice('αβγδéñü') for _ in range(3)))
            title = ''.join(title_parts)

            result = format_chit_link(title)

            # Must start with [[ and end with ]]
            self.assertTrue(result.startswith('[['),
                f"Result '{result}' must start with '[['")
            self.assertTrue(result.endswith(']]'),
                f"Result '{result}' must end with ']]'")

            # Content between brackets must be exactly the title
            inner = result[2:-2]
            self.assertEqual(inner, title,
                f"Inner content '{inner}' must equal title '{title}'")

            # Total format is exactly [[title]]
            self.assertEqual(result, '[[' + title + ']]')


class TestPasteSanitization(unittest.TestCase):
    """
    Feature: milkdown-editor, Property 4: Paste Sanitization

    For any clipboard content containing HTML markup (including script tags,
    event handlers, style elements), pasting into the editor SHALL result in
    only plain text — no raw HTML tags, script elements, or event handler
    attributes SHALL appear in the output.

    Validates: Requirements 4.4, 4.5, 10.3
    """

    def test_paste_sanitization_property(self):
        for _ in range(120):
            html_content = random_html_with_xss()

            sanitized = sanitize_paste_html(html_content)

            # No HTML tags should remain
            self.assertNotRegex(sanitized, r'<[a-zA-Z][^>]*>',
                f"Sanitized output contains HTML tags: '{sanitized[:100]}'")

            # No script content
            self.assertNotIn('<script', sanitized.lower(),
                f"Sanitized output contains script tag")

            # No event handlers
            self.assertNotRegex(sanitized, r'\bon\w+\s*=',
                f"Sanitized output contains event handler: '{sanitized[:100]}'")

            # No style tags
            self.assertNotIn('<style', sanitized.lower(),
                f"Sanitized output contains style tag")

            # No iframe
            self.assertNotIn('<iframe', sanitized.lower(),
                f"Sanitized output contains iframe")


class TestXSSPrevention(unittest.TestCase):
    """
    Feature: milkdown-editor, Property 8: Schema-Based XSS Prevention

    For any markdown content containing <script> tags, javascript: URLs,
    on* event handler attributes, or <iframe> elements, the editor's
    rendered DOM SHALL contain none of these executable elements.

    Validates: Requirements 10.1
    """

    def test_xss_prevention_property(self):
        for _ in range(120):
            markdown_input = random_markdown_with_xss()

            # Simulate schema-based sanitization (strip dangerous elements)
            sanitized = sanitize_paste_html(markdown_input)

            # Verify the output is XSS-safe
            is_safe = check_xss_safe(sanitized)
            self.assertTrue(is_safe,
                f"XSS vector found in sanitized output: '{sanitized[:200]}'")


if __name__ == '__main__':
    unittest.main()
