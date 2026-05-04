## CWOC Release 20260504.1145

Email view polish: Select All now uses a native checkbox matching the row checkboxes for visual consistency, positioned at the far left of the bulk bar. From field expanded from 300px to 500px max-width and allowed to wrap so multiple addresses aren't cut off. Subjects now strip markdown link syntax (showing just the link text, not URLs) via new `_emailStripMarkdown` helper. Body preview also strips markdown in addition to HTML. Scoped bulk bar checkbox queries to avoid conflicts with the Select All checkbox.
