# W405: renderChecklistItemMarkdown(span, text)

## What the web function does
Renders inline markdown within checklist item text. Supports bold (**text**), italic (*text*), strikethrough (~~text~~), inline code (`code`), and links [text](url) within checklist items. This makes checklist items richer than plain text.

## What exists on Android
- ChecklistZone renders checklist items as plain text
- MarkdownRenderer exists for notes but is not applied to checklist items
- Checklist items show raw markdown syntax instead of rendered formatting

## What's missing
1. No inline markdown rendering in checklist item text
2. Bold, italic, strikethrough, code, and links show as raw syntax
3. MarkdownRenderer would need to be applied to individual checklist item text spans
