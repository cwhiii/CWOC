# BB — Miscellaneous (5 items: BB1–BB5)

## Status: COMPLETE — all 5 items addressed

## Android files created:
- `android/app/src/main/java/com/cwoc/app/ui/util/UnitConverter.kt` (NEW)
- `android/app/src/main/java/com/cwoc/app/ui/components/ChitPickerSheet.kt` (NEW)
- `android/app/src/main/java/com/cwoc/app/ui/components/CwocPromptDialog.kt` (NEW)
- `android/app/src/main/java/com/cwoc/app/ui/components/ClockModal.kt` (NEW)

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/navigation/SidebarContent.kt`

---

## BB1 — No unit conversion system ✅ COMPLETE (5/5 sub-items)

1. ✅ `UnitConverter` object created with conversion methods
2. ✅ `formatTemperature(celsius, unitSystem)` — °C ↔ °F
3. ✅ `formatDistance(km, unitSystem)` — km ↔ mi
4. ✅ `formatSpeed(kmh, unitSystem)` — km/h ↔ mph
5. ✅ `formatWeight(kg, unitSystem)` — kg ↔ lbs + `formatHeight(cm, unitSystem)` — cm ↔ ft/in

## BB2 — No chit picker modal ✅ COMPLETE (4/4 sub-items)

1. ✅ `ChitPickerSheet` composable — ModalBottomSheet with searchable chit list
2. ✅ Accepts `List<Pair<String, String>>` (id, title) pairs
3. ✅ Search field filters by title (case-insensitive)
4. ✅ `onChitSelected(chitId)` callback on item tap

## BB3 — No prompt modal ✅ COMPLETE (3/3 sub-items)

1. ✅ `CwocPromptDialog` composable — AlertDialog with text input
2. ✅ Accepts title, placeholder, initialValue, onConfirm, onDismiss
3. ✅ Uses `cwocTextFieldColors()` for CWOC-themed input styling

## BB4 — No clock modal ✅ COMPLETE (4/4 sub-items)

1. ✅ `ClockModal` composable — AlertDialog showing multiple timezone clocks
2. ✅ Accepts list of IANA timezone IDs from settings
3. ✅ Shows city name, date, and formatted time for each timezone
4. ✅ Respects 12h/24h time format setting

## BB5 — Sidebar: no logo, no Audit Log link, no Custom Objects link ✅ COMPLETE (5/5 sub-items)

1. ✅ CWOC logo Image added at top of sidebar (from R.drawable.cwoc_logo)
2. ✅ "Audit Log" navigation link added (Section Z)
3. ✅ "Custom Objects" navigation link added (Section Z)
4. ✅ Rules Manager route defined in Screen.kt (Section Z)
5. ✅ User Admin route defined in Screen.kt (Section Z)
