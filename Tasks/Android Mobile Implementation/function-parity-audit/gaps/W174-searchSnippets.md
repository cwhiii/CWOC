# W174-175: Search Snippets

## What the web functions do
- `_getSearchSnippet(text, terms)` — Extracts a text snippet around the first matching search term, with context before/after. Shows "...prefix **match** suffix..." style highlights.
- `_getChitFieldValue(chit, fieldName)` — Gets the value of a specific field from a chit object for search snippet extraction (searches across title, note, location, tags, people, checklist text, etc.)

## What exists on Android
- `SearchViewModel` performs text search across chit fields
- `SearchScreen` displays results with title and basic info
- No snippet extraction showing WHERE in the content the match was found

## What's missing
1. No search result snippets showing context around the matched term
2. No field-level search indicating WHICH field matched (title vs note vs location vs checklist)
3. Users see matching chits but can't tell why they matched without opening each one
