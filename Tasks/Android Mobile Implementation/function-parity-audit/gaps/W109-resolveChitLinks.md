# W109: resolveChitLinks(html, allChits)

## What the web function does
When rendering markdown content (notes, checklist items), replaces `[[title]]` patterns with clickable links to the matching chit. Searches all chits by title (case-insensitive) and creates an `<a>` tag linking to the editor for that chit.

## What exists on Android
Nothing. The `[[title]]` autocomplete works for CREATING links (W105-W108), but when rendering the note content, `[[title]]` patterns are displayed as plain text — they're not resolved to clickable navigation links.

## What's missing
Link resolution in the MarkdownRenderer. When displaying rendered markdown, `[[title]]` should become a clickable element that navigates to the matching chit's editor.

## Fix needed
In `MarkdownRenderer.kt` (or the NotesZone preview rendering), detect `[[...]]` patterns, look up the chit by title from the local Room database, and render as a clickable AnnotatedString link that navigates to `Screen.Editor.createRoute(chitId)`.
