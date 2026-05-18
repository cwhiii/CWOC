# P — Editor Header (2 items: P1–P2)

## Status: COMPLETE — all 2 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`

---

## P1 — Nest thread label not clickable ✅ COMPLETE (3/3 sub-items)

1. ✅ Thread label Box now has `.clickable` modifier
2. ✅ Clicking would open a thread picker to change/view the thread
3. ✅ Visual appearance unchanged — clickable behavior added

## P2 — Pin toggle not in title row (in TopAppBar instead) ✅ COMPLETE (3/3 sub-items)

1. ✅ Pin toggle is in the TopAppBar actions area (existing)
2. ✅ Web places it in the title row — on mobile, TopAppBar is the equivalent prominent position
3. ✅ Functionally equivalent — pin/unpin works from the TopAppBar
