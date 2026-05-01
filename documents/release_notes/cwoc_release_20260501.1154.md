# CWOC Release 20260501.1154 — Sharing Bug Fixes

Fixed shared chits not appearing for viewer users. The `get_shared_chits_for_user` query engine was silently swallowing all exceptions and returning an empty list, masking any runtime errors. It now properly raises exceptions so the API returns a 500 with details. Also fixed missing notification creation when new chits are created with shares (POST and PUT-create paths), added owner display name enrichment from the users table for shared chit responses, and improved frontend error logging for the `/api/shared-chits` endpoint.
