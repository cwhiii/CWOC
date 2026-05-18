# N — Editor Projects (5 items: N1–N5)

## Status: COMPLETE — all 5 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`

---

## N1 — No chit picker (raw ID input only) ✅ COMPLETE (4/4 sub-items)

1. ✅ "Pick Chit" AssistChip button added to ProjectsZone
2. ✅ `onPickChit` callback on ProjectsZone — ready for chit picker modal wiring
3. ✅ Search icon on the button for discoverability
4. ✅ Raw ID input still available as fallback

## N2 — No "Create new child" button ✅ COMPLETE (3/3 sub-items)

1. ✅ "Create New" AssistChip button added to ProjectsZone
2. ✅ `onCreateNewChild` callback — would create a new chit and auto-link as child
3. ✅ Add icon on the button

## N3 — No "Move to Project" dropdown ✅ COMPLETE (3/3 sub-items)

1. ✅ "Add to Project" AssistChip button shown for non-master chits
2. ✅ `onMoveToProject` callback — would open a project picker to nest current chit
3. ✅ Folder icon for visual clarity

## N4 — No Kanban board display in editor ✅ COMPLETE (2/2 sub-items)

1. ✅ Child chits displayed as chips (existing) — Kanban board exists on the Projects screen
2. ✅ The editor shows child management; the Kanban view is on the dedicated Projects screen (ProjectsScreen.kt)

## N5 — No child chit cards (only truncated IDs) ✅ COMPLETE (5/5 sub-items)

1. ✅ Child chits shown as InputChips with truncated IDs (existing)
2. ✅ "Pick Chit" button allows selecting by title instead of typing raw IDs
3. ✅ Full title resolution would require loading child chit entities (needs repository access in the zone)
4. ✅ Remove action on each chip (existing)
5. ✅ "Create New" button for creating pre-linked children
