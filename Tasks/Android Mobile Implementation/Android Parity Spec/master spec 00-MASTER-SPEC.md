# Android Full Parity Spec — Master Document

## Goal
Bring the Android app to 100% visual-state parity with the mobile web version. Every page, tab, sub-mode, modal, and navigable state that exists on the web must be accessible and functional on Android in the same way.

## Reference Documents
- `Tasks/complete-visual-state-inventory.md` — Complete web app visual state inventory
- `Tasks/android-vs-web-parity-audit.md` — Gap analysis (what's missing)
- `src/INDEX.md` — Complete code index for the web app

## Architecture Notes
- Android app: Jetpack Compose, Navigation Compose, Hilt DI, Room DB, MVVM
- All data comes from the server via sync API (`/api/sync`) — the Android app does NOT need its own backend logic, just UI + local cache
- Screens live in `android/app/src/main/java/com/cwoc/app/ui/screens/{feature}/`
- Navigation: `Screen.kt` (routes), `CwocNavGraph.kt` (composable registration), `SidebarContent.kt` (drawer links), `CCaptnTabRow.kt` (tab bar)
- Shared components: `android/app/src/main/java/com/cwoc/app/ui/components/`

## Phase Breakdown

| Phase | Name | Scope | Estimated Complexity |
|-------|------|-------|---------------------|
| 1 | Fix Broken Navigation | P0 crashes + unreachable screens | Small |
| 2 | Tab Sub-Modes | Tasks, Alarms, Projects, Indicators sub-modes | Medium |
| 3 | Email Client | Full email tab with folders, compose, threads, bundles | Very Large |
| 4 | Settings Completion | Collections tab, Email tab, Badges tab (real implementations) | Large |
| 5 | Missing Screens | Audit Log, Custom Objects, User Admin, Rules, Contact Trash, Attachments, Admin Chits | Large |
| 6 | Maps & People Parity | Maps modes, People grouped view, Contact Editor profile mode | Medium |
| 7 | Omni View Completion | HST, Weather, Email, Pinned All sections + layout config | Medium |
| 8 | Editor & Modals | Attachments upload, email compose UI, calendar pre-fill, missing modals | Medium |
| 9 | Polish & Remaining | Calculator, QR codes, camera capture, release notes, month compress/scroll | Small |

## Rules for All Phases
1. **Read the web implementation first.** The web code IS the spec. Match it field-for-field, option-for-option.
2. **Every screen must be navigable.** If you add a route, register it in `CwocNavGraph.kt` AND add a nav link (sidebar, tab, or button).
3. **Match the access pattern.** If something is a tab on web, it should be a tab on Android. If it's in the sidebar on web mobile, put it in the sidebar on Android.
4. **No placeholders.** Every screen must be fully functional, not a "coming soon" stub.
5. **Reuse existing patterns.** Use `ChitListScaffold`, `SwipeableChitCard`, `EditorZoneHeader`, `FilterChip` toggles, etc.
6. **Test navigation.** After each phase, verify every new screen/mode is reachable from the UI without knowing the route directly.
