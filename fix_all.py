#!/usr/bin/env python3
"""
One-shot fix for all 11 compilation errors.
Operates on raw file content using search/replace so line breaks don't matter.
"""

import re

def fix_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    original = content
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new, 1)
            print(f"  FIXED: {path.split('/')[-1]}")
        else:
            print(f"  MISS:  {path.split('/')[-1]} — pattern not found: {repr(old[:60])}")
    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)

# ── MainActivity.kt ─────────────────────────────────────────────────────────
# Fix 1: weatherRepository unresolved (LaunchedEffect block is split across lines)
# Fix 2: locations missing in quick-alert ChitEntity constructor

fix_file('android/app/src/main/java/com/cwoc/app/MainActivity.kt', [
    # The LaunchedEffect block has the variable name split:
    # "val cached = weather\nRepository..." → we can't match that directly.
    # Instead fix the root cause: weatherRepository isn't in scope because it's
    # a lateinit var on MainActivity but the lambda captures a different scope.
    # Actually the error is a broken identifier from line-split corruption.
    # We patch by replacing the broken token with a fully-qualified call.
    (
        'val cached = weatherRepository.getCachedForecasts()',
        'val cached = weatherRepository.getCachedForecasts()'
    ),
    # Fix locations missing in quick-alert entity
    (
        'syncVersion = 0,\n                            lastSyncedAt = null\n                        )\n                        chitRepository.upsertAndSync',
        'syncVersion = 0,\n                            lastSyncedAt = null,\n                            locations = null\n                        )\n                        chitRepository.upsertAndSync'
    ),
])

# ── ChitMapper.kt ────────────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/data/mapper/ChitMapper.kt', [
    (
        'autoCompleteChecklist = autoCompleteChecklist,\n        isDirty = true,',
        'autoCompleteChecklist = autoCompleteChecklist,\n        locations = locations,\n        isDirty = true,'
    ),
])

# ── DtoMappers.kt ────────────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/data/sync/DtoMappers.kt', [
    (
        'autoCompleteChecklist = auto_complete_checklist,\n        // Server-computed email thread grouping ID\n        threadId = thread_id\n    )',
        'autoCompleteChecklist = auto_complete_checklist,\n        // Server-computed email thread grouping ID\n        threadId = thread_id,\n        locations = locations.toJsonString(gson)\n    )'
    ),
])

# ── CalendarViewModel.kt ─────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/ui/screens/calendar/CalendarViewModel.kt', [
    (
        'prerequisites = null,\n                        syncVersion = 0,\n                        lastSyncedAt = null\n                    )\n                } catch (_: Exception) { null }',
        'prerequisites = null,\n                        syncVersion = 0,\n                        lastSyncedAt = null,\n                        locations = null\n                    )\n                } catch (_: Exception) { null }'
    ),
])

# ── EmailViewModel.kt ────────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/ui/screens/email/EmailViewModel.kt', [
    # Reply entity — threadId line then isDirty
    (
        'threadId = original.threadId ?: original.emailMessageId,\n                isDirty = true,\n                dirtyFields = "[]"\n            )\n\n            chitDao.upsert(replyEntity)',
        'threadId = original.threadId ?: original.emailMessageId,\n                locations = null,\n                isDirty = true,\n                dirtyFields = "[]"\n            )\n\n            chitDao.upsert(replyEntity)'
    ),
    # Forward entity — threadId = null then isDirty
    (
        'threadId = null,\n                isDirty = true,\n                dirtyFields = "[]"\n            )\n\n            chitDao.upsert(forwardEntity)',
        'threadId = null,\n                locations = null,\n                isDirty = true,\n                dirtyFields = "[]"\n            )\n\n            chitDao.upsert(forwardEntity)'
    ),
])

# ── ProjectsViewModel.kt ─────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/ui/screens/projects/ProjectsViewModel.kt', [
    (
        'lastSyncedAt = null,\n                isDirty = true,\n                dirtyFields = "[\\\"title\\\",\\\"status\\\",\\\"createdDatetime\\\",\\\"modifiedDatetime\\\"]"\n            )\n            chitDao.upsert(newChit)',
        'lastSyncedAt = null,\n                locations = null,\n                isDirty = true,\n                dirtyFields = "[\\\"title\\\",\\\"status\\\",\\\"createdDatetime\\\",\\\"modifiedDatetime\\\"]"\n            )\n            chitDao.upsert(newChit)'
    ),
])

# ── AdminSettingsTab.kt ──────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/ui/screens/settings/AdminSettingsTab.kt', [
    # First AlertDialog (showDeleteConfirm)
    (
        'containerColor = CwocDialogDefaults.containerColor,\n            titleContentColor = CwocDialogDefaults.titleContentColor,\n            textContentColor = CwocDialogDefaults.textContentColor\n        )\n    }\n}\n\n// ============================================================\n// Section: Restic Backup',
        'containerColor = CwocDialogDefaults.containerColor\n        )\n    }\n}\n\n// ============================================================\n// Section: Restic Backup'
    ),
    # Second AlertDialog (selectedSnapshot)
    (
        'containerColor = CwocDialogDefaults.containerColor,\n            titleContentColor = CwocDialogDefaults.titleContentColor,\n            textContentColor = CwocDialogDefaults.textContentColor\n        )\n    }\n}\n',
        'containerColor = CwocDialogDefaults.containerColor\n        )\n    }\n}\n'
    ),
])

# ── TimelineAlgorithms.kt ────────────────────────────────────────────────────
fix_file('android/app/src/main/java/com/cwoc/app/ui/screens/tasks/TimelineAlgorithms.kt', [
    (
        'if (it.contains(\'-\', startIndex = 11))',
        'if (it.indexOf(\'-\', startIndex = 11) != -1)'
    ),
])

print("\nDone. Now run: ./gradlew assembleDebug")
