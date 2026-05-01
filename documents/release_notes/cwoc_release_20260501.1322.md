# CWOC Release 20260501.1322 — Tag Sharing Persistence Fix

Fixed tag-level sharing config being wiped every time settings were saved. The main settings save (`POST /api/settings`) used `INSERT OR REPLACE` which overwrote the entire row, but the frontend never included `shared_tags` in the payload — so it was reset to NULL on every save. Fixed both sides: the backend now preserves the existing `shared_tags` value when the frontend doesn't send it, and the tag modal Done button now always persists the sharing config to the server (previously it only saved on tag rename).
