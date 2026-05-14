# Release 20260513.2117

Added fingerprint-based skip-render optimization. When fetchChits() returns data that hasn't changed (same count + max modified_datetime), the expensive DOM re-render is skipped entirely. Also removed unnecessary JSON deep-clone in cache rendering for faster startup.
