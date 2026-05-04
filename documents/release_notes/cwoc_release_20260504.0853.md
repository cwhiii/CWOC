# Release 20260504.0853

Fixed "Failed to load contacts" error caused by the GET /api/contacts query referencing the `shared_to_vault` column before the migration had run. The endpoint now checks for column existence via PRAGMA table_info before using it in the WHERE clause, gracefully falling back to owner-only queries if the column doesn't exist yet.
