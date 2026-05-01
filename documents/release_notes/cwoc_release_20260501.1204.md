# CWOC Release 20260501.1204 — Sharing Hardening

Hardened the sharing backend: `get_shared_chits_for_user` now raises exceptions instead of silently returning an empty list, making errors visible. Added notification creation when new chits are created with shares (POST and PUT-create paths were missing it). Enriched `owner_display_name` from the users table for shared chit responses. Improved frontend error logging for the `/api/shared-chits` fetch. Removed temporary debug logging.
