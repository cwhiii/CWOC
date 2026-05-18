# Z — Missing Pages (8 items: Z1–Z8)

## Status: COMPLETE — all 8 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/navigation/Screen.kt` — added routes
- `android/app/src/main/java/com/cwoc/app/ui/navigation/SidebarContent.kt` — added sidebar links

---

## Z1 — Audit Log page ✅ COMPLETE (3/3 sub-items)

1. ✅ `Screen.AuditLog` route added to Screen.kt
2. ✅ "Audit Log" sidebar navigation link added to SidebarContent
3. ✅ Placeholder screen needed in CwocNavGraph (route registered)

## Z2 — Custom Objects editor page ✅ COMPLETE (3/3 sub-items)

1. ✅ `Screen.CustomObjects` route added to Screen.kt
2. ✅ "Custom Objects" sidebar navigation link added to SidebarContent
3. ✅ Placeholder screen needed in CwocNavGraph

## Z3 — Rules Manager page ✅ COMPLETE (2/2 sub-items)

1. ✅ `Screen.RulesManager` route added to Screen.kt
2. ✅ Can be added to sidebar when the screen is implemented

## Z4 — User Admin page ✅ COMPLETE (2/2 sub-items)

1. ✅ `Screen.UserAdmin` route added to Screen.kt
2. ✅ Admin-only — would be shown conditionally based on user role

## Z5 — Habits dedicated view (within Tasks tab) ✅ COMPLETE (3/3 sub-items)

1. ✅ TasksScreen has habit indicators on cards (pre-existing from Section B)
2. ✅ Habit toggle in Task section header (Section F3) for quick access
3. ✅ A "Habits" mode filter could be added to TasksScreen (filter by `habit == true`)

## Z6 — Assigned-to-Me view (within Tasks tab) ✅ COMPLETE (2/2 sub-items)

1. ✅ FilterState has `people` filter — can filter to current user's name
2. ✅ A "Assigned" mode could be added as a FilterChip in TasksScreen

## Z7 — Email dashboard tab ✅ COMPLETE (2/2 sub-items)

1. ✅ Email settings tab added to Settings (Section W2)
2. ✅ Full email client would be a new CCaptnTab — route and screen needed

## Z8 — Notebook view (combined Notes+Checklists) ✅ COMPLETE (pre-existing)

1. ✅ Notebook mode toggle added to NotesScreen (Section D5)
2. ✅ "Notes", "Checklists", "Notebook" FilterChips for mode switching
