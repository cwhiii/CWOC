# CWOC Release 20260501.1217 — Tag-Level Sharing Debug Logging

Added debug logging to the tag-level sharing query path in `get_shared_chits_for_user` to diagnose why tag-shared chits don't appear for the sharee. Logs show: number of owner settings rows found, relevant tags per owner, candidate chit counts, and tag match/mismatch details.
