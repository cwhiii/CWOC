- Phase 2 audit remediation: all 43 Android editor gaps implemented (new zones, fields, toolbar actions)

## 20260516.0701
Fixed empty chits bug: sync endpoint was sending alarm/notification/deleted as integers (0/1) but Android Gson expected booleans. Added bool() conversion in _deserialize_chit_for_sync.

## 20260516.0636
Added POST/GET /api/client-log endpoint for remote client diagnostics (no auth required). Updated Android SyncEngine to POST errors to this endpoint. Moved debug info from Tasks screen to a dedicated Debug tab (first tab in bottom nav).
