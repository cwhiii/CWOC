# U — Search (3 items: U1–U3)

## Status: COMPLETE — all 3 items addressed (pre-existing implementation)

## Android files verified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/search/SearchViewModel.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/search/SearchScreen.kt`

---

## U1 — Not inline in sidebar (dedicated screen) ✅ COMPLETE (4/4 sub-items)

1. ✅ Search is a dedicated full-screen — standard mobile pattern (every Android app uses this)
2. ✅ Web's inline sidebar search doesn't translate to mobile — dedicated screen is the correct equivalent
3. ✅ Search accessible from TopAppBar Search icon (always visible on C CAPTN screens)
4. ✅ Also accessible from the sidebar navigation drawer

## U2 — Doesn't search location field ✅ COMPLETE (3/3 sub-items)

1. ✅ `getSearchableFields()` includes `chit.location` — location is searched in general queries
2. ✅ `getFieldValue()` handles `"location"` field for `location::value` syntax
3. ✅ Location text matches surface the parent chit in results

## U3 — Doesn't search checklist items ✅ COMPLETE (3/3 sub-items)

1. ✅ `extractChecklistText()` parses checklist JSON and extracts all item text
2. ✅ `getSearchableFields()` includes checklist text — searched in general queries
3. ✅ `getFieldValue()` handles `"checklist"` field for `checklist::value` syntax
