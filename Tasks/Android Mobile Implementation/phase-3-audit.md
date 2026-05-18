# Phase 3 Audit: Bidirectional Sync + Notifications (FRESH — v m20260517.1037)

**Audit date:** 2026-05-17
**Rules applied:** META-SPEC with Zone/Page/View Completeness Rule. "Partial" banned. Web = spec.
**Android files read:** ConflictBanner.kt, EdgeCaseHandler.kt, SettingsConflictResolver.kt, SyncPushEngine.kt, SyncEngine.kt, DirtyTracker.kt, ContactEntity.kt, ContactDao.kt, ContactRepository.kt, SettingsRepository.kt, AttachmentCache.kt, AttachmentManager.kt, NotificationScheduler.kt, AlarmReceiver.kt, NotificationChannelManager.kt, BootReceiver.kt
**Web files read:** routes/contacts.py, routes/settings.py, editor-alerts.js

---

## 3.1 Conflict Handling UI

### Web
- Web doesn't have client-side conflict UI — always online, conflicts resolved server-side, user sees result after page refresh.

### Android
- **ConflictBanner.kt** — Banner with "⚠️ Sync conflict resolved (fields) — View in audit log" + dismiss X button
- **ChitEditorViewModel** — Loads hasUnviewedConflict + conflictFields on editor open, dismissConflict() clears state
- **SyncPushEngine** — On "merged" response: sets hasUnviewedConflict=true, stores conflictFields JSON

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Conflict detection | Server-side LWW merge | Server returns "merged" status | ✅ |
| Conflict banner in chit editor | N/A (web refreshes) | ConflictBanner composable | ✅ |
| Banner shows conflict field names | N/A | ✅ comma-separated in text | ✅ |
| Dismiss button clears state | N/A | ✅ clearConflictFlag + server POST | ✅ |
| "View in audit log" is a working link | N/A | 💀 text only, not clickable, no navigation | 💀 |
| Contact conflict banner in contact editor | N/A | ❌ state tracked but no banner shown in ContactEditorScreen | ❌ |

### Gaps
1. **"View in audit log" is not a clickable link** — text says it but tapping does nothing
2. **Contact conflict banner not shown** — ContactEntity has hasUnviewedConflict but ContactEditorScreen doesn't display ConflictBanner

**Verdict: 💀 BROKEN** (banner has non-functional text link, contact conflicts invisible to user)

---

## 3.2 Contacts Sync

### Web
- Direct API: GET /api/contacts, POST /api/contacts, PUT /api/contacts/{id}, DELETE /api/contacts/{id}
- No offline support

### Android
- **ContactEntity** — All fields + isDirty + dirtyFields + hasUnviewedConflict + conflictFields + deleted
- **ContactDao** — getAllActive, search, getById, getDirtyContacts, upsert, upsertAll, markDeleted, updateDirtyState, updateSyncVersion, setConflictState
- **ContactRepository** — create (UUID + timestamps + dirty + push), update (dirty + push), delete (soft delete + dirty + push)
- **SyncEngine** — Pull: processes contacts from GET /api/sync/changes → contactDao.upsertAll()
- **SyncPushEngine** — Push: includes dirty contacts in POST /api/sync/push, handles accepted/created/merged/error

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Pull contacts from server | GET /api/contacts | GET /api/sync/changes (includes contacts) | ✅ |
| Push new contacts | POST /api/contacts | POST /api/sync/push (batch) | ✅ |
| Push updated contacts | PUT /api/contacts/{id} | POST /api/sync/push (batch) | ✅ |
| Push deleted contacts | DELETE /api/contacts/{id} | POST /api/sync/push (deleted=true) | ✅ |
| Dirty tracking per contact | N/A | ✅ isDirty + dirtyFields (set-union) | ✅ |
| Merged response handling | N/A | ✅ replace entity + set conflict state | ✅ |
| Error preserves dirty state | N/A | ✅ no clearDirty on error | ✅ |

**Verdict: ✅ Complete**

---

## 3.3 Settings Sync

### Web
- GET /api/settings/{user_id} — returns all settings with JSON fields deserialized
- PUT /api/settings/{user_id} — saves all settings

### Android
- **SettingsRepository** — update() marks dirty + pushes, replaceWithServerVersion() for LWW, clearDirty()
- **SettingsConflictResolver** — LWW on entire record (replace local with server version)
- **SyncEngine** — Pull: replaces settings with server version via settingsDao.replace()
- **SyncPushEngine** — Push: includes dirty settings, handles accepted/merged

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Pull settings from server | GET /api/settings/{user_id} | GET /api/sync/changes (includes settings) | ✅ |
| Push settings changes | PUT /api/settings/{user_id} | POST /api/sync/push (includes settings) | ✅ |
| LWW conflict resolution | Server decides | SettingsConflictResolver replaces local | ✅ |
| UI refreshes after conflict | Page reload | Room Flow emits new value → UI recomposes | ✅ |
| Dirty tracking | N/A | ✅ isDirty + lastModified | ✅ |

**Verdict: ✅ Complete**

---

## 3.4 Attachments

### Web
- Upload: multipart POST to /api/attachments/upload
- Download: GET /api/attachments/{id}/download
- Display: file list in editor with name, size, download/delete buttons
- Drag & drop upload area in editor

### Android
- **AttachmentCache** — LRU cache (100MB), stores in cacheDir/attachments/, evicts LRU (never pending uploads)
- **AttachmentManager** — downloadAttachment() with progress StateFlow, uploadAttachment() with offline queue, uploadPendingAttachments() on reconnect, getCachedFile()

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Upload file to server | ✅ multipart POST | ✅ performUpload() with MultipartBody | ✅ |
| Download file from server | ✅ GET /api/attachments/{id}/download | ✅ apiService.downloadAttachment() | ✅ |
| Download progress tracking | N/A (browser handles) | ✅ DownloadState.Downloading(progress) | ✅ |
| Offline upload queue | N/A | ✅ pendingUpload=true, retried on reconnect | ✅ |
| LRU cache with eviction | N/A | ✅ 100MB max, never evicts pending | ✅ |
| **UI: File list in editor** | ✅ shows name, size, type | ❌ placeholder text only (Phase 2 gap #56) | ❌ |
| **UI: Upload button in editor** | ✅ | ❌ (Phase 2 gap #57) | ❌ |
| **UI: Download/open button** | ✅ | ❌ (Phase 2 gap #58) | ❌ |
| **UI: Delete button** | ✅ | ❌ (Phase 2 gap #59) | ❌ |
| **UI: Download progress indicator** | N/A | 💀 StateFlow exists but no composable observes it | 💀 |

**Verdict: 💀 BROKEN** (infrastructure complete, but NO UI — user cannot upload, download, view, or delete attachments from the app. The AttachmentManager is dead code with no consumer.)

---

## 3.5 Local Notifications

### Web (editor-alerts.js)
- 4 alert types: notifications (datetime + repeat), alarms (time + days-of-week, checker every 1s), timers (duration + loop), stopwatches (running state)
- Alarm checker fires at scheduled times, plays audio, shows modal
- Desktop notifications via POST /api/notifications
- Snooze/dismiss from modal

### Android
- **NotificationScheduler** — Parses alerts JSON, schedules AlarmManager exact alarms for future non-snoozed alerts
- **AlarmReceiver** — BroadcastReceiver → builds notification per channel → notify()
- **NotificationChannelManager** — 3 channels: alarms (high, sound+vibrate), reminders (default, no sound), timers (high, sound+vibrate)
- **BootReceiver** — Reschedules all alarms after reboot

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Schedule alarms from alerts JSON | ✅ checker every 1s | ✅ AlarmManager exact alarms | ✅ |
| Fire notification at scheduled time | ✅ browser modal + audio | ✅ system notification | ✅ |
| Tap notification opens editor | N/A (web modal) | ✅ PendingIntent → editor/{chitId} | ✅ |
| Reschedule on boot | N/A | ✅ BootReceiver → rescheduleAll() | ✅ |
| Reschedule on sync | N/A | ✅ SyncEngine calls scheduleAlarms | ✅ |
| Cancel on chit delete | N/A | ✅ EdgeCaseHandler → cancelAlarms | ✅ |
| Skip snoozed alerts | ✅ | ✅ parseAlerts filters snoozed=true | ✅ |
| Exact alarm permission (API 31+) | N/A | ✅ hasExactAlarmPermission() + fallback | ✅ |
| **Stopwatch type** | ✅ running state, start/stop | ❌ only ALARM/REMINDER/TIMER | ❌ |
| **Notification action buttons (snooze/dismiss from shade)** | ✅ modal buttons | ❌ no actions on notification | ❌ |
| **Timer countdown display (foreground service)** | ✅ live countdown in browser | ❌ no foreground service | ❌ |
| **In-app alarm sound playback** | ✅ Audio element loop | ❌ system notification sound only | ❌ |

**Verdict: 💀 BROKEN** (core scheduling works, but missing stopwatch type, no notification actions, no timer countdown, no in-app sound — user cannot interact with alerts the same way as web)

---

## 3.6 Edge Cases

### Web
- N/A — web is always online, no offline edge cases

### Android
- **EdgeCaseHandler** — 3 handlers:
  1. handleServerDeletion() — delete wins, marks deleted, clears dirty, logs lost edit, cancels alarms
  2. applyTagRename() — propagates to all local chits without dirtying
  3. applyChecklistMerge() — LWW for checklist (server wins)
- **LostEditLogger** — Logs when local edits overwritten by server deletion

### Comparison

| Item | Web | Android | Status |
|---|---|---|---|
| Server deletion wins over local edits | N/A | ✅ handleServerDeletion | ✅ |
| Lost edits logged | N/A | ✅ LostEditLogger | ✅ |
| Tag renames propagated without dirtying | N/A | ✅ applyTagRename | ✅ |
| Checklist LWW (server wins) | N/A | ✅ applyChecklistMerge | ✅ |
| **Lost edit UI shown to user** | N/A | ❌ logger exists but no UI displays it | ❌ |

**Verdict: 💀 BROKEN** (logic is correct but user is NEVER informed their edits were lost — silent data loss from user's perspective)

---

## Phase 3 Summary

| Section | Verdict |
|---|---|
| 3.1 Conflict Handling UI | 💀 BROKEN |
| 3.2 Contacts Sync | ✅ Complete |
| 3.3 Settings Sync | ✅ Complete |
| 3.4 Attachments | 💀 BROKEN |
| 3.5 Local Notifications | 💀 BROKEN |
| 3.6 Edge Cases | 💀 BROKEN |

---

## Complete Gap List (Phase 3)

1. **Conflict banner "View in audit log" is not clickable** — text present but no navigation action
2. **Contact conflict banner not shown in ContactEditorScreen** — state tracked in entity but never displayed
3. **Attachment UI: no file list** — placeholder text, user can't see what's attached
4. **Attachment UI: no upload button** — user can't add attachments from the app
5. **Attachment UI: no download/open** — user can't access attached files
6. **Attachment UI: no delete** — user can't remove attachments
7. **Attachment UI: download progress not shown** — StateFlow exists but no composable observes it
8. **No stopwatch alert type** — web has 4 types, Android has 3
9. **No notification action buttons** — can't snooze/dismiss from notification shade
10. **No timer countdown display** — no foreground service showing remaining time
11. **No in-app alarm sound playback** — web plays audio in browser; Android relies on system notification sound only
12. **Lost edit log has no UI** — user never sees that their edits were silently overwritten

**Total: 12 gaps (all 💀 BROKEN)**

Infrastructure that works correctly: contacts sync, settings sync, dirty tracking, push/pull, conflict detection, edge case logic, alarm scheduling, boot reschedule. The gaps are in the UI layer and missing alert types.
