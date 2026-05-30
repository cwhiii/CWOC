# No Fake Progress Bars

Progress bars are great, but they must reflect reality.

## Rules

- Never use timer-based fake progress (e.g., setTimeout advancing a bar from 30% to 60% to 85%).
- Never hardcode percentage milestones that don't correspond to actual backend events.
- Never show "stage labels" that are just guesses about what the server might be doing.

## What to do instead

- **Use the Celery task pattern.** Start a background task, return a `task_id`, and expose a `/status/{task_id}` polling endpoint that reports real `percent`, `label`, and `status`, just like typo scan and cover generation already do.
- **Poll from the frontend** and update the progress bar with the real values the server returns.
- **Use actual upload progress** via XHR/fetch progress events (`xhr.upload.onprogress`) for file uploads. That's real data.
- If an operation is too fast or too simple to warrant a task queue (< 1-2 seconds), use an indeterminate spinner instead of a bar. Don't invent fake stages for a quick request.

## Rule of thumb

If the percentage isn't coming from the server or from a real browser event, don't show a percentage. Either add real server-side progress reporting, or use a spinner.
