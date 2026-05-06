# CWOC Release 20260505.2154 — Database Locking Fix + Email Improvements

Fixed "database is locked" errors that were blocking email sync and auth. Added WAL journal mode (set at init, persists at file level) and 5-second busy_timeout on middleware connections so concurrent requests wait instead of failing. Added sync diagnostic logging. Also: discard draft button, reply/forward deduplication (won't create duplicate drafts), email card hover contrast fix, and thread ribbon visual on dashboard.
