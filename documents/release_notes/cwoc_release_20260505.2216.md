# CWOC Release 20260505.2216 — Email Sync Improvements

- Email sync now fetches newest messages first and processes ALL messages (no max_pull cap), committing in batches of 50
- Sync response includes per-account details (nickname, messages found, new count, since date)
- Check Mail toast shows account-specific results
- Failed accounts turn their sidebar pill red with a pulse animation instead of a generic error toast
- Clicking a red error pill shows a persistent toast with full error details and a "Copy Error" button
- Successful syncs clear the error state on that account's pill
- Fixed database locking (WAL mode + busy_timeout)
- Fixed startup crash (sqlite3 import in main.py)
- Fixed duplicate try: block in email.py
