# CWOC Android App — Roadmap

## Summary

Build a native Android app (Kotlin + Jetpack Compose) that keeps all chit data on-device, works fully offline, and syncs back to the server when connectivity returns. The web app stays fully intact — the Android app is an additional client, not a replacement.

**Server-side sync infrastructure is complete** (Phase 0, done 2026-05-15). All remaining work is client-side.

**Estimated timeline:** 2-3 months with heavy LLM assistance.

---

## Phase 0: Server Prep ✅ COMPLETE

*All items done as of version 20260515.1338 via the `mobile-sync-prep` spec.*

- ✅ UUID primary keys (already existed)
- ✅ `sync_version` column on chits, contacts, settings tables + global counter in `sync_state` table
- ✅ Sync pull endpoint: `GET /api/sync/changes?since={version}&include=chits,contacts,settings`
- ✅ Sync push endpoint: `POST /api/sync/push` with field-level LWW conflict resolution
- ✅ Device token auth: `POST /api/auth/device-token`, Bearer token middleware, `device_tokens` table
- ✅ Device management API: `GET /api/devices`, `DELETE /api/devices/{id}`, `PATCH /api/devices/{id}`
- ✅ `has_unviewed_conflict` flag on chits + `POST /api/chit/{id}/dismiss-conflict` endpoint
- ✅ Audit log entries for conflicts (`sync_conflict_resolved` action with both versions per field)
- ✅ Tombstone retention (trash purge checks all active devices have synced past deletion)
- ✅ Contacts and settings sync (field-level merge for contacts, LWW for settings)
- ✅ WebSocket broadcast of push changes to connected web clients
- ✅ `last_sync_version` updated on device after each successful pull

---

## Phase 1: Read-Only Android App

*Goal: Authenticate, pull all data, display it natively. Validates the architecture and sync-pull mechanism.*

**Budget: 2-3 weeks**

### 1.1 Project Setup
- Create Android project: Kotlin, Jetpack Compose, API 26+ (Android 8.0+)
- Configure Hilt (dependency injection), Room (local DB), Retrofit + OkHttp (API), Compose Navigation
- Material 3 theming with CWOC parchment colors (primary `#6b4e31`, background `#fffaf0`, surface `#f5e6d3`, Lora font)

### 1.2 Authentication
- Login screen: username + password → `POST /api/auth/device-token`
- Store returned token in Android EncryptedSharedPreferences (backed by Keystore)
- All subsequent API calls use `Authorization: Bearer <token>` header
- Handle 401 responses (revoked token → redirect to login)

### 1.3 Local Database (Room)
- Define Room entities mirroring server schema: `ChitEntity`, `ContactEntity`, `SettingsEntity`
- Add sync metadata columns: `sync_version`, `last_synced_at`, `is_dirty`
- Define DAOs with queries for all C CAPTN view filters
- Database migrations strategy (Room's built-in migration support)

### 1.4 Initial Sync (Full Pull)
- On first login: call `GET /api/sync/changes?since=0&include=chits,contacts,settings`
- Populate local Room database with all records
- Store `server_version` from response as the device's high-water mark

### 1.5 Core Views (Read-Only)
- Chit list screen (all chits, searchable/filterable)
- Tasks view (status-based grouping)
- Notes view (markdown rendering via a Compose markdown library)
- Calendar view (day + week only)
- Navigation: bottom nav bar with C CAPTN tabs

### 1.6 Visual Identity
- Parchment theme adapted for native Android (Material 3 structure, CWOC skin)
- Lora font loaded as a custom font family
- Brown tones, card styling, indicator icons matching web app

---

## Phase 2: Offline CRUD + Live Sync

*Goal: Full create/edit/delete while offline. Live sync via WebSocket when online. Push queued changes on reconnect.*

**Budget: 3-4 weeks**

### 2.1 Chit Editor
- Full editor screen with all chit fields (title, note, dates, status, priority, tags, checklist, people, location, color, alerts, recurrence)
- Create new chits (generate UUID locally)
- Edit existing chits
- Soft-delete chits
- Mark edited records as dirty (`is_dirty = true`, store `dirty_fields` JSON array)

### 2.2 Dirty Tracking & Queue
- Every local write sets `is_dirty = true` on the record
- Track which fields changed per record (`dirty_fields` array)
- Queue management: ordered list of pending changes to push

### 2.3 Sync Push (Reconnect)
- On connectivity restored: push all dirty records via `POST /api/sync/push`
- Each pushed chit includes `last_known_sync_version` (the version the client last saw from the server)
- Handle response statuses per record: `accepted`, `created`, `merged`, `error`
- Clear dirty flags on successful push
- Pull any missed changes: `GET /api/sync/changes?since={last_known_version}`

### 2.4 Live Sync (WebSocket)
- Connect to `/ws/sync` when online (OkHttp WebSocket client)
- Receive real-time change notifications → pull updated records
- Seamless transition: WorkManager detects connectivity → push dirty → pull changes → open WebSocket
- If WebSocket drops, fall back to periodic polling (every 30s) until reconnect

### 2.5 Connectivity Management
- Android ConnectivityManager monitors network state
- WorkManager enqueues one-time sync job on connectivity restored (automatic retry + backoff)
- UI indicator showing online/offline/syncing state

---

## Phase 3: Full Bidirectional Sync + Notifications

*Goal: Handle conflicts gracefully. Sync contacts/settings/attachments. Local notifications.*

**Budget: 3-4 weeks**

### 3.1 Conflict Handling (Client Side)
- When push returns `status: "merged"` with `conflict_fields`:
  - Update local record with server's merged version
  - Set `has_unviewed_conflict = true` locally
  - Show conflict banner next time user opens the chit in editor
- Conflict banner: "⚠️ Sync conflict resolved — View in audit log"
- Dismiss conflict: `POST /api/chit/{id}/dismiss-conflict`

### 3.2 Contacts Sync
- Mirror contacts table locally (same Room entity pattern as chits)
- Pull contacts via `GET /api/sync/changes?include=contacts`
- Push contact changes via `POST /api/sync/push` (contacts array)
- Field-level merge on conflicts (same as chits)

### 3.3 Settings Sync
- Mirror settings locally
- Pull via `GET /api/sync/changes?include=settings`
- Push via `POST /api/sync/push` (settings object)
- LWW on entire record (no field-level merge)

### 3.4 Attachments Sync
- Download attachments on first access (lazy loading)
- Upload new attachments on sync push
- Local cache with size management
- *Consider deferring to Phase 4 if this slows things down*

### 3.5 Local Notifications
- Android AlarmManager + NotificationChannels for chit alerts
- Mirror the server's alert/notification system locally
- Fire notifications based on local chit data (no server dependency)
- Notification types: alarms (sound), timers (countdown), reminders (silent push)

### 3.6 Edge Case Handling
- Delete vs. edit conflict: delete wins, log the lost edit in audit
- Checklist reorder conflict: LWW on entire checklist blob
- Settings conflict: LWW, full stop
- Tag renames: apply rename to all local chits bearing the old tag name

---

## Phase 4: Feature Parity & Polish

*Goal: Remaining views, maps, widgets, animations. Open-ended — ship after Phase 3.*

**Budget: Ongoing**

### 4.1 Remaining C CAPTN Views
- Checklists view (interactive nested checklists)
- Projects view (Kanban board with drag-drop)
- Alerts/Alarms view (independent alerts board)
- Indicators view (health data charts)

### 4.2 Maps Integration
- Android MapView (Google Maps or OSM via osmdroid)
- Chit location markers with color coding
- Geocoding via existing backend proxy

### 4.3 Home Screen Widget
- Quick-add chit widget
- Today's calendar widget
- Upcoming tasks widget

### 4.4 Polish
- Animations and transitions
- Pull-to-refresh
- Swipe actions (archive, delete, snooze)
- Search with boolean operators (port from web)
- Recurrence expansion (port `shared-recurrence.js` to Kotlin)

### 4.5 Future Considerations
- Kotlin Multiplatform (KMP) extraction if iOS ever becomes a goal
- Web UI for device management in Settings page
- Conflict cherry-pick UI in the app (currently audit-log only)

---

## Phase 5: Core Usability

*Goal: Close the most critical functional gaps. Sidebar/menu, search, filters, sort, proper editor UIs, settings page, trash, unsaved changes detection. Makes the app a viable daily driver.*

**Budget: 4-5 weeks**

**Spec:** `.kiro/specs/android-app/android-phase5a-core-usability/`

---

## Phase 6: Feature Parity

*Goal: Full feature parity with the web app. Contact editor, additional calendar views, Omni View, tags UI, markdown preview, pin/archive/snooze, habits, weather, help, notifications.*

**Budget: 4-5 weeks**

**Spec:** `.kiro/specs/android-app/android-phase5b-feature-parity/`

---

## Phase 7: Advanced Features

*Goal: Remaining advanced features. Audit log, attachments, quick-edit modal, import/export, contact QR/vCard, location UI with geocoding, email view (read-only).*

**Budget: 3-4 weeks**

**Spec:** `.kiro/specs/android-app/android-phase5c-advanced-features/`

---

## Phase 8: Pixel-Perfect & Gesture-Identical UI Replication

*Goal: The native app must be IDENTICAL to the mobile browser version. Not similar. Not inspired by. IDENTICAL — pixel for pixel, gesture for gesture, across every screen, view, page, and tool. A user switching between the mobile browser and the native app should not be able to tell the difference except for performance.*

**The standard: screenshot the mobile browser, screenshot the native app. They must be indistinguishable.**

**Budget: 4-6 weeks**

### 8.1 Navigation — Exact Replication
- **No bottom tab bar.** The web app does not have one. Remove it entirely.
- **Swipe from right** opens the C CAPTN view tabs — same panel, same animation speed, same overlay opacity, same tab order, same icons, same labels (Alarms, not Alerts)
- **Swipe from left** opens the menu/options panel — same items, same order, same icons, same behavior
- Gesture thresholds must match exactly: same swipe distance to trigger, same velocity threshold, same spring-back animation if cancelled
- Back button / back gesture must behave identically to browser back (close overlay first, then navigate)

### 8.2 Every Label, Every Icon, Every String
- Audit EVERY piece of text in the native app against the web app: screen titles, tab labels, button text, placeholder text, empty state messages, error messages, toast messages, modal titles, modal body text, confirm/cancel button labels
- Zero tolerance for deviation. If the web says "Alarms," the app says "Alarms." If the web says "Quick Edit," the app says "Quick Edit." Character for character.
- Icons must be identical — bundle Font Awesome 6 if Material equivalents don't match exactly. Same icon, same size, same color, same position.

### 8.3 Layout — Pixel-Level Fidelity
- Every screen must match the mobile browser layout exactly: same margins, same padding, same font sizes, same line heights, same border radii, same shadow/elevation values
- Chit cards: same height, same internal spacing, same indicator positions, same badge placement, same truncation behavior, same line-clamp count
- Calendar views: same cell sizes, same event chip appearance, same multi-day bar rendering, same pinch-zoom behavior, same drag handle appearance
- Editor: same zone order, same zone toggle animation, same field sizes, same button placement, same color picker appearance
- Settings: same tab layout, same section ordering, same toggle appearance, same input field styling
- People page: same list layout, same avatar sizing, same contact card appearance
- Trash: same layout, same restore/purge button placement
- Audit log: same table/list appearance
- Help page: same navigation, same rendering
- Weather page: same layout, same data presentation

### 8.4 Interactions — Gesture for Gesture
- **Tap** targets: same size, same hit area, same feedback (ripple must match web's tap highlight)
- **Long-press**: same delay threshold, same visual feedback, same resulting action
- **Drag-and-drop**: same initiation gesture, same drag ghost appearance, same drop zone highlighting, same reorder animation
- **Swipe actions** on cards/items: same direction, same reveal distance, same action buttons, same colors
- **Pull-to-refresh**: same trigger distance, same spinner appearance (or match web's refresh behavior exactly)
- **Pinch-zoom** (calendar): same zoom levels, same snap points, same animation
- **Scroll behavior**: same momentum, same overscroll effect, same sticky headers
- **Modal dismiss**: same tap-outside behavior, same swipe-down-to-dismiss, same back-button-closes
- **Quick-edit modal**: same trigger, same appearance, same fields, same save/cancel behavior
- **Checklist interactions**: same tap-to-toggle, same drag-to-reorder, same indent/outdent gesture, same undo behavior

### 8.5 Every Page, Every Tool — Complete Audit
- Systematically open every page in the mobile browser and the native app side by side
- Screenshot both. Overlay them. Fix every difference.
- Pages to audit (exhaustive list):
  - Dashboard (all 6 C CAPTN views in each state: populated, empty, filtered, searched)
  - Chit Editor (every zone open, every zone closed, every field type)
  - Settings (every tab, every section, every toggle/input)
  - People list + Contact Editor
  - Weather page
  - Trash page
  - Audit Log page
  - Help page
  - Calendar (day, week, month, year, itinerary, X-day — each view)
  - Search results
  - All modals (delete confirm, unsaved changes, quick-edit, tag create, color picker, etc.)
  - All toasts (success, error, undo countdown)
  - All empty states
  - All error states
  - All loading states

### 8.6 Behavioral Edge Cases
- ESC/back-button priority chain must be identical to web's ESC chain
- Unsaved changes detection must trigger at the same moments
- Dirty tracking must flag the same fields
- Sort order persistence must work identically
- Filter combinations must produce identical results
- Search must return identical results with identical highlighting
- Tag tree must render identically (same expand/collapse, same nesting)
- Recurrence display must format identically
- Date/time formatting must match exactly (same format strings, same relative time display)
- Markdown rendering in notes must produce identical output

---

## Phase 9: Native Platform Advantages

*Goal: Leverage native Android capabilities that are difficult or impossible via the mobile browser. These are additive features — they enhance the app beyond what the web can do.*

**Budget: Ongoing**

### 9.1 Push Notifications & Alarms
- Native alarm scheduling via AlarmManager (survives app kill, respects Do Not Disturb)
- Rich notifications with actions (Mark Complete, Snooze, Open)
- Notification channels per alert type (Alarms, Reminders, Timers) with user-configurable priority
- Exact alarm scheduling (not subject to browser tab throttling)

### 9.2 Location Services
- Background location polling for location-based reminders ("remind me when I arrive at...")
- Geofencing for automatic chit triggers (enter/exit a saved location)
- Passive location tagging — auto-suggest location when creating a chit based on current position
- Battery-efficient location strategy (significant motion detection → precise fix only when needed)

### 9.3 Background Sync & Freshness
- True background sync via WorkManager (periodic + event-driven)
- Sync completes even when app is closed (not possible in mobile browser)
- Instant push via Firebase Cloud Messaging (FCM) for real-time updates without polling

### 9.4 System Integration
- Share intent: receive text/links/images from other apps → create chit
- Calendar provider integration: optionally mirror chits to Android system calendar
- Contacts provider integration: link CWOC contacts to system contacts
- Quick Settings tile for rapid chit creation
- App shortcuts (long-press app icon → New Task, New Note, Today's Calendar)

### 9.5 Offline Resilience
- Full offline operation with zero degradation (no "you're offline" limitations)
- Attachment caching with intelligent preloading on Wi-Fi
- Offline search across all local data (instant, no server round-trip)

### 9.6 Hardware Access
- Camera integration for quick photo attachments
- Voice-to-text for note dictation
- NFC tag scanning for location check-in or quick-add triggers
- Biometric lock (fingerprint/face) for app access

---

## Architecture Decisions

### Technology Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | Kotlin | Official Android language, excellent LLM corpus coverage |
| UI | Jetpack Compose | Modern declarative UI, Material 3 support |
| Local DB | Room (SQLite) | Same engine as server, compile-time query verification |
| Networking | Retrofit + OkHttp | Standard, well-supported, built-in WebSocket client |
| DI | Hilt | Official Jetpack DI, minimal boilerplate |
| Background | WorkManager | Survives app restarts, respects battery/network constraints |
| Auth storage | EncryptedSharedPreferences | Backed by Android Keystore |

### Sync Strategy
- **Field-level merge with LWW fallback** — non-conflicting field edits merge automatically; same-field conflicts resolved by latest `modified_datetime`
- **Silent resolution + notification banner** — never interrupt the user at sync time; show banner on next chit open if conflict occurred
- **Whole-chit transfer, field-level tracking** — push/pull entire chit JSON, but track `dirty_fields` locally for server-side merge logic
- **Two modes**: live (WebSocket) when online, queued (WorkManager) when offline

### Conflict Rules
| Scenario | Resolution |
|----------|-----------|
| Same chit, different fields edited | Merge both (no conflict) |
| Same chit, same field edited | LWW by `modified_datetime` |
| Deleted on one side, edited on other | Delete wins |
| Checklist reordered on both sides | LWW on entire checklist blob |
| Settings changed on both sides | LWW on entire record |
| Tag renamed on server | Apply rename to all local chits with old tag |

### What NOT to Do
- Don't share code between web (vanilla JS) and mobile (Kotlin) — share the API contract instead
- Don't use CRDTs — overkill for single-user with rare conflicts
- Don't use JWTs — long-lived device tokens are simpler and work offline
- Don't try to ship all 6 C CAPTN views in v1 — Tasks + Notes + Calendar covers 80% of daily use
- Don't build for iOS yet — if it ever happens, extract data layer via KMP later

---

## Project Structure

```
app/
  src/main/
    java/com/cwoc/app/
      di/                  # Hilt dependency injection modules
      data/
        local/             # Room database, DAOs, entities
        remote/            # Retrofit API service, DTOs
        repository/        # Repository pattern (local + remote)
        sync/              # Sync engine (WorkManager, conflict resolution)
      ui/
        theme/             # Colors, typography, shapes (parchment)
        navigation/        # Nav graph, screen routes
        screens/
          login/           # Login screen
          chits/           # Chit list, filters
          editor/          # Chit editor
          calendar/        # Calendar views
          tasks/           # Tasks view
          notes/           # Notes view
      model/               # Domain models (Chit, Contact, Settings)
    res/
      values/              # Strings, colors, themes
      drawable/            # Icons, images
    AndroidManifest.xml    # Permissions, activities
  build.gradle.kts         # Dependencies, SDK versions
```

---

## Server API Contract (What the App Talks To)

All endpoints require `Authorization: Bearer <device_token>` header unless noted.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/device-token` | POST | Authenticate with username/password, get device token (no auth required) |
| `/api/sync/changes?since={v}&include=chits,contacts,settings` | GET | Pull all changes since version v |
| `/api/sync/push` | POST | Push local changes (chits, contacts, settings arrays) |
| `/api/chit/{id}/dismiss-conflict` | POST | Clear conflict notification flag |
| `/api/devices` | GET | List registered devices |
| `/api/devices/{id}` | DELETE | Revoke a device token |
| `/api/devices/{id}` | PATCH | Rename a device |
| `/ws/sync` | WS | Real-time change notifications |

**Sync pull response shape:**
```json
{
  "server_version": 4523,
  "chits": [{ "id": "...", "sync_version": 4520, ... }],
  "contacts": [{ "id": "...", "sync_version": 4521, ... }],
  "settings": { "sync_version": 4522, ... }
}
```

**Sync push request shape:**
```json
{
  "chits": [{ "id": "...", "last_known_sync_version": 4500, ...all fields... }],
  "contacts": [{ "id": "...", "last_known_sync_version": 4501, ... }],
  "settings": { "last_known_sync_version": 4502, ... }
}
```

**Sync push response shape:**
```json
{
  "results": {
    "chits": [
      { "id": "uuid-1", "status": "accepted", "sync_version": 4524 },
      { "id": "uuid-2", "status": "merged", "sync_version": 4525, "conflict_fields": ["title", "note"] },
      { "id": "uuid-3", "status": "created", "sync_version": 4526 }
    ],
    "contacts": [...],
    "settings": { "status": "accepted", "sync_version": 4527 }
  },
  "server_version": 4527
}
```

---

## Getting Started

### What to Install
1. **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio) (~2GB download, ~8GB installed). Includes SDK, emulator, build tools.
2. **JDK 17+** — bundled with Android Studio, or `brew install openjdk@17`

No Google Developer account needed. Build the APK, sideload to your phone.

### Scaffold Prompt (Give This to the LLM)

> "Create a new Android app project using Kotlin and Jetpack Compose. Target API 26+ (Android 8.0+). Set up:
> - Hilt for dependency injection
> - Room for local SQLite database
> - Retrofit + OkHttp for API calls
> - Compose Navigation for screen routing
> - Material 3 theming with custom colors (browns/parchment: primary #6b4e31, background #fffaf0, surface #f5e6d3)
> - A basic login screen that authenticates against `https://<server>/api/auth/device-token`
>
> Project name: CWOC, package: com.cwoc.app"

### Porting JS Logic to Kotlin
Feed these files to the LLM and ask for Kotlin equivalents (pure functions, no DOM):
- `shared-recurrence.js` → recurrence expansion
- `shared-tags.js` → tag tree building
- `shared-checklist.js` → checklist nesting logic
- `shared-indicators.js` → indicator display logic

---

## Effort Estimate

| Component | Effort | Phase |
|-----------|--------|-------|
| Server sync infrastructure | — | ✅ Phase 0 |
| Device auth (server) | — | ✅ Phase 0 |
| Android app shell + navigation | Medium | Phase 1 |
| Local SQLite database + Room DAOs | Medium | Phase 1 |
| Tasks + Notes + Calendar views | Large | Phase 1-2 |
| Chit editor (all fields) | Large | Phase 2 |
| Offline CRUD + dirty tracking | Medium | Phase 2 |
| Sync engine (client-side) | Large | Phase 2-3 |
| Live sync (WebSocket) | Medium | Phase 2 |
| Conflict handling (client UI) | Medium | Phase 3 |
| Local notifications | Medium | Phase 3 |
| Contacts/settings sync | Small | Phase 3 |
| Attachments sync | Medium | Phase 3-4 |
| Remaining views (Checklists, Projects, Alerts, Indicators) | Large | Phase 4 |
| Maps, widgets, polish | Medium | Phase 4 |
| Sidebar/menu, search, filters, sort | Large | Phase 5 |
| Proper editor UIs (date picker, checklist, color, alerts, recurrence) | Large | Phase 5 |
| Settings page, trash, unsaved changes, undo | Medium | Phase 5 |
| Contact editor, calendar views (Month/Year/Itinerary/X-Day) | Large | Phase 6 |
| Omni View, tags UI, markdown preview, pin/archive/snooze | Large | Phase 6 |
| Habits, weather, help, notifications | Medium | Phase 6 |
| Audit log, attachments, quick-edit modal | Medium | Phase 7 |
| Import/export, contact QR/vCard, location UI, email view | Medium | Phase 7 |
| Navigation & gesture alignment (swipe panels) | Large | Phase 8 |
| Label/naming audit & fixes | Small | Phase 8 |
| Layout & visual fidelity pass | Large | Phase 8 |
| Interaction parity (drag, modals, quick-edit) | Large | Phase 8 |
| Feature gap audit & fixes | Medium | Phase 8 |
| Native notifications & alarms | Medium | Phase 9 |
| Location services & geofencing | Large | Phase 9 |
| Background sync & FCM | Medium | Phase 9 |
| System integration (share, calendar, contacts) | Medium | Phase 9 |
| Hardware access (camera, voice, NFC, biometrics) | Medium | Phase 9 |
| Integration testing | Large | Ongoing |

---

## Glossary

| Term | Definition |
|------|-----------|
| CRUD | Create, Read, Update, Delete — the four basic data operations |
| DAO | Data Access Object — a class providing database query methods (Room pattern) |
| ORM | Object-Relational Mapping — maps database rows to code objects |
| LWW | Last Write Wins — conflict resolution where the latest edit by timestamp is kept |
| Tombstone | A soft-deleted record retained so other devices learn about the deletion during sync |
| Dirty flag | A marker on a local record indicating unsaved changes that need pushing to the server |
| Room | Android Jetpack's SQLite ORM — compile-time verified queries, entity/DAO pattern |
| Hilt | Android's official dependency injection framework (built on Dagger) |
| WorkManager | Android API for scheduling background work that survives app restarts |
| Compose | Jetpack Compose — Android's modern declarative UI toolkit |
| KMP | Kotlin Multiplatform — share Kotlin code across Android/iOS/desktop |
| Material 3 | Google's latest design system for Android (Material You) |

---

## Key Android Concepts

| Concept | What It Does |
|---------|-------------|
| Activity | Single screen container. Modern apps have ONE activity + Compose Navigation for screens |
| ViewModel | Holds UI state, survives screen rotation. Each screen gets one |
| Repository | Mediates between local DB and remote API. Sync logic lives here |
| WorkManager | Schedules background sync jobs. Survives restarts, respects battery/network |
| Hilt | Dependency injection. Wires everything together automatically |
| Room | SQLite wrapper. Define entities (tables) and DAOs (queries) as Kotlin classes, Room generates the implementation |
| ConnectivityManager | Android API that reports network state changes (online/offline transitions) |
| EncryptedSharedPreferences | Secure key-value storage backed by Android Keystore (for tokens) |
