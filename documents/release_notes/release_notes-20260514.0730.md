# Release 20260514.0730

Fixed tag save operations (create/update/delete) to send only the `tags` field as a partial update instead of the entire settings object, preventing accidental overwrites of unrelated settings. Added 401 retry logic with auth re-check to tag operations and settings save — if a POST gets 401, it verifies the session is still valid and retries once before redirecting to login. Added `custom_view_filters` column migration and backend support. Improved auth middleware logging for session rejection diagnostics.
