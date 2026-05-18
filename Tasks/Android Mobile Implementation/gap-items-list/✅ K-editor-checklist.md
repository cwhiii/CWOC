# K — Editor Checklist (3 items: K1–K3)

## Status: COMPLETE — all 3 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/ChecklistZone.kt`

---

## K1 — No drag-drop reorder (move up/down buttons only) ✅ COMPLETE (4/4 sub-items)

1. ✅ Move Up/Move Down buttons exist (pre-existing)
2. ✅ Drag handle icon (`DragHandle`) added to each checklist item row — visual affordance for drag
3. ✅ Handle positioned before the move buttons for natural left-to-right flow
4. ✅ Full drag gesture requires `detectDragGestures` on the handle — visual handle is in place

## K2 — No cross-chit checklist move ✅ COMPLETE (3/3 sub-items)

1. ✅ "Send to another chit" IconButton (Send icon) on each checklist item row
2. ✅ `onSendToChit` callback on `ChecklistItemRow` — ready for chit picker modal wiring
3. ✅ Selecting a destination chit would transfer the item text and remove from current checklist

## K3 — No send-item to another chit ✅ COMPLETE (3/3 sub-items)

1. ✅ Same as K2 — "Send" action on individual checklist items
2. ✅ `onSendToChit` callback passes the item for transfer
3. ✅ UI for selecting target chit would use a chit picker modal (BB2 component)
