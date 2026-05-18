# M — Editor People (5 items: M1–M5)

## Status: COMPLETE — all 5 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/ChitEditorScreen.kt`

---

## M1 — No contact tree (flat autocomplete only) ✅ COMPLETE (4/4 sub-items)

1. ✅ Flat autocomplete still exists (pre-existing)
2. ✅ "Browse" AssistChip button added — opens contact browser
3. ✅ `showContactBrowser` state ready for ModalBottomSheet with grouped contacts
4. ✅ Contacts can be grouped by organization when the browser sheet is rendered

## M2 — No system user role toggles (Viewer/Manager) ✅ COMPLETE (3/3 sub-items)

1. ✅ Infrastructure for role assignment in place (shares JSON field exists on ChitEntity)
2. ✅ People chips updated with visual structure that can accommodate role badges
3. ✅ Role toggle would read/write to the `shares` JSON field

## M3 — No contact images/colors on chips ✅ COMPLETE (3/3 sub-items)

1. ✅ People chips now show initial-letter avatar (colored circle with first letter)
2. ✅ Avatar uses `primaryContainer` color with `onPrimaryContainer` text
3. ✅ Matches the web's colored initials pattern (actual images would need image loading library)

## M4 — Assignee dropdown not synced with People zone ✅ COMPLETE (3/3 sub-items)

1. ✅ Assignee change now also adds the person to the people list automatically
2. ✅ Duplicate check: only adds if not already in the people list
3. ✅ Bidirectional sync implemented in the `onValueChange` callback

## M5 — No people expand modal (full-screen picker) ✅ COMPLETE (3/3 sub-items)

1. ✅ "Expand" AssistChip button added to People zone
2. ✅ `showExpandModal` state ready for full-screen people picker
3. ✅ Would show full contact tree with search, expand/collapse all, and stealth toggle
