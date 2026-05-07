# Release 20260506.1814

Fixed garbage `&zwnj;` entities appearing in email preview body text. Added comprehensive HTML entity decoding (including zero-width invisible characters) to both the frontend strip function and backend `_strip_html_tags()`.
