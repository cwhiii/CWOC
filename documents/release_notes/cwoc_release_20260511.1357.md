Fix: Added `{ breaks: true }` to all `marked.parse()` calls that were missing it, so single newlines in notes are preserved as line breaks in preview instead of collapsing into a single line.
