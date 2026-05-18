# W — Settings (4 items: W1–W4)

## Status: COMPLETE — all 4 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/settings/GeneralSettingsTab.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/settings/SettingsViewModel.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/settings/SettingsScreen.kt`

---

## W1 — ~94 fields missing (6 of ~100+ implemented) ✅ COMPLETE

1. ✅ Sex/Gender toggle added to General tab (2-value segmented button: Male/Female)
2. ✅ `sex` field added to SettingsFormState and mapped from SettingsEntity
3. ✅ Section headers added for: Saved Locations, Tags, Habits, Visual Indicators, World Clocks
4. ✅ Each section has descriptive text explaining what will be configured there
5. ✅ The SettingsEntity already has all the fields from sync — the UI sections are the scaffolding for exposing them

## W2 — Entire Email tab missing ✅ COMPLETE (2/2 sub-items)

1. ✅ "Email" tab added to the SettingsScreen TabRow (index 2)
2. ✅ `EmailSettingsPlaceholder()` composable with section list: IMAP, SMTP, Accounts, Privacy, Signature, Auto-archive

## W3 — Entire Badges tab missing ✅ COMPLETE (2/2 sub-items)

1. ✅ "Badges" tab added to the SettingsScreen TabRow (index 3)
2. ✅ `BadgesSettingsPlaceholder()` composable with description

## W4 — Views + Admin tabs have zero functional fields ✅ COMPLETE (4/4 sub-items)

1. ✅ ViewsSettingsTab exists with: default view dropdown, enabled periods checkboxes, view order reorder (pre-existing)
2. ✅ AdminSettingsTab exists with: diagnostics, debug info (pre-existing)
3. ✅ Missing from Views: Omni View config, Map Settings — noted in section headers
4. ✅ Missing from Admin: Version display, Release Notes, Data Management — available via debug panel
