# W135-W137: Email Nesting (nest_thread_id)

## What the web feature does
Allows non-email chits to be "nested" into email threads by setting `nest_thread_id`:
- W135: `_emailInjectNests(threads)` — injects nested chits into email thread display
- W136: `_buildNestedChitCard(chit)` — renders a nested chit card within the thread
- W137: `_nestGetContentPreview(chit)` — gets content preview for the nested chit

## What exists on Android
- `ChitEntity.nestThreadId` field exists (data is synced)
- No UI renders nested chits within email threads
- No editor UI to set nest_thread_id on a chit

## What's missing
1. Rendering nested chits within email thread views
2. UI to nest a chit into an email thread (editor zone or action)

## Fix needed
In `EmailThreadView.kt` / `EmailThreadViewInEditor.kt`, query for chits where `nestThreadId` matches the current thread's message ID, and render them inline between email messages.
