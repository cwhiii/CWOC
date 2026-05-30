# No Guessing at Solutions

## Rules

- Do NOT guess at the cause of a failure. If something is broken and you don't have enough information, ASK FOR LOGS.
- If a container is crashing, ask the user to run `docker compose logs <service> --tail=50` and paste the output.
- If a deploy fails, ask for the actual error output before proposing fixes.
- Never propose multiple speculative fixes in sequence hoping one sticks. Get the real error first, then fix it once.
- One targeted question ("paste the app container logs") is always better than three wrong guesses that waste the user's time and patience.
