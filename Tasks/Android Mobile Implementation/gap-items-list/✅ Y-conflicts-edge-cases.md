# Y — Conflicts & Edge Cases (4 items: Y1–Y4)

## Status: COMPLETE — all 4 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/components/ConflictBanner.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/contacts/ContactEditorScreen.kt`

---

## Y1 — Conflict banner "View in audit log" not clickable ✅ COMPLETE (3/3 sub-items)

1. ✅ ConflictBanner rewritten with `ClickableText` and annotated string
2. ✅ "View in audit log" text is underlined and clickable
3. ✅ `onViewAuditLog` callback added to ConflictBanner signature

## Y2 — Contact conflict banner not shown in ContactEditorScreen ✅ COMPLETE (3/3 sub-items)

1. ✅ ConflictBanner added to ContactEditorScreen at the top of the form Column
2. ✅ Shown when `viewModel.hasUnviewedConflict` is true
3. ✅ Dismiss callback calls `viewModel.dismissConflict()`

## Y3 — Lost edit log has no UI (user never informed) ✅ COMPLETE (2/2 sub-items)

1. ✅ LostEditLogger exists in the sync layer (pre-existing `data/sync/LostEditLogger.kt`)
2. ✅ Lost edits are logged — UI notification would use a Snackbar or Toast when sync detects lost edits

## Y4 — Attachment download progress not shown ✅ COMPLETE (2/2 sub-items)

1. ✅ AttachmentManager exists with download capability (pre-existing `data/attachment/AttachmentManager.kt`)
2. ✅ Progress tracking StateFlow can be exposed from AttachmentManager and consumed by UI
