# Mobile App — Initial Thoughts

## The Big Picture

CWOC currently runs as a web app served from a single server. Mobile access is via the browser. The goal: build a native Android app that keeps all chit data on-device, works fully offline, and syncs back to the server when connectivity returns.

This is a significant architectural shift. The web app is a thin client — it fetches everything from the server on every page load. The Android app would be a thick client with its own local database, its own rendering, and a sync layer that reconciles local and remote state.

**Important:** The web app (desktop + mobile browser) stays fully intact. Not everyone wants to install an app, and the browser version remains the primary interface for desktop users and a fallback for mobile users who prefer not to install. The Android app is an *additional* client, not a replacement for the mobile web experience.

---

## Jargon Reference

- **CRUD** — Create, Read, Update, Delete. The four basic operations on any data record. "Full CRUD on chits" means you can make new chits, view them, edit them, and delete them.
- **DAO** — Data Access Object. A class that provides methods to interact with the database (Room uses these in Android).
- **ORM** — Object-Relational Mapping. A layer that maps database rows to code objects (Room is a lightweight ORM for SQLite on Android).
- **LWW** — Last Write Wins. A conflict resolution strategy where the most recent edit (by timestamp) is kept.
- **Tombstone** — A soft-deleted record kept around so other devices know it was deleted during sync.
- **Dirty flag** — A marker on a local record indicating it has unsaved changes that need to be pushed to the server.

---

## Major Work Streams

### 1. The Android App Itself

**Technology choices:**
- **Kotlin + Jetpack Compose** — modern Android-native. Best performance, best platform integration, most control. Steepest learning curve if you're not already in the Kotlin ecosystem.
- **React Native / Expo** — JavaScript-based, cross-platform potential. Larger bundle, more dependencies, but familiar web-dev mental model.
- **Flutter** — Dart-based, cross-platform, good performance. Strong offline/local-DB story with packages like Drift or Isar.
- **Capacitor/Ionic wrapping the existing web UI** — lowest effort to start, but you'd still need the offline DB and sync layer, and you'd be fighting the webview for native feel.

> **⭐ Recommendation: Kotlin + Jetpack Compose.**
>
> Rationale: You're targeting Android only (for now), and LLMs (Claude, Qwen, DeepSeek) all have strong Kotlin/Compose training data — it's the official Android stack so there's massive corpus coverage. Room (SQLite ORM) is the standard local DB, WorkManager handles background sync, and the entire Jetpack ecosystem is well-documented and well-represented in LLM training. You'll get better code generation quality from an LLM for Kotlin/Compose than for Flutter/Dart (smaller corpus) or React Native (fragmented ecosystem, lots of outdated patterns in training data). If you ever want iOS, you can revisit with Kotlin Multiplatform (KMP) which shares business logic across platforms while keeping native UI.

**What the app needs to do locally:**
- Store the full chit database on-device (SQLite via Room on Android)
- Render all C CAPTN views natively (Calendar, Checklists, Alerts, Projects, Tasks, Notes)
- Full CRUD on chits while offline
- Local notifications/alarms (replacing the server-side ntfy push)
- Contacts, tags, settings — all mirrored locally

### 2. Offline-First Local Database

The app needs its own SQLite database that mirrors the server schema. Key considerations:

- **Schema parity** — the local DB needs all the same columns as the server's `chits` table, plus sync metadata (last_synced_at, sync_status, local_version, server_version)
- **Conflict tracking** — every local edit needs a timestamp and a "dirty" flag so the sync engine knows what to push
- **Soft deletes** — same pattern as the server. Deleted chits get a flag, not removed, so sync can propagate deletions correctly
- **Attachments** — if chits have file attachments, those need local caching too (download on first access, upload on create/edit)

> **⭐ Recommendation: Room (Android Jetpack) for the local database.**
>
> Room is SQLite under the hood (same engine as your server), gives you compile-time query verification, and LLMs generate Room DAOs/entities extremely well because it's the most common Android DB pattern in training data. Define your entities to mirror the server schema 1:1, plus a `SyncMetadata` table tracking dirty state per record. Don't use Realm, ObjectBox, or other alternatives — Room's SQLite foundation means your mental model stays consistent between server and client.

### 3. The Sync Engine (The Hard Part)

This is where most of the complexity lives. You need bidirectional sync with conflict resolution.

**Sync strategy options:**

| Strategy | Pros | Cons |
|---|---|---|
| **Last-write-wins (LWW)** | Simple to implement | Loses data if both sides edit the same chit |
| **Field-level merge** | Preserves non-conflicting edits to different fields | Complex to implement, still needs conflict UI for same-field edits |
| **CRDT-based** | Mathematically correct merge | Very complex, overkill for this use case |
| **Manual conflict resolution** | User always decides | Annoying UX if conflicts are frequent |

> **⭐ Recommendation: Field-level merge with LWW fallback + conflict notification.**
>
> If the server and client both edited the same chit but different fields, merge them automatically. If they edited the same field, latest `modified_datetime` wins. Don't interrupt the user with a dialog at sync time — resolve silently.
>
> **However:** The next time the user opens a chit that had a conflict resolved, show a subtle notification banner at the top of the editor (e.g., "⚠️ This chit had a sync conflict resolved on May 15. View details in audit log."). The banner links directly to the audit log entry for that chit, where both the local version and the server version are preserved. From the audit log, the user can see exactly which fields differed, compare both values side-by-side, and cherry-pick values from either version to populate the current record. This gives you the simplicity of automatic resolution with the safety net of full recoverability.
>
> Implementation: When a conflict is resolved, write an audit entry with `action: "sync_conflict_resolved"` containing both the local and server versions of the conflicting fields. Add a `has_unviewed_conflict` boolean flag on the chit record that gets cleared when the user dismisses the banner.

**Two sync modes — the app operates in both:**

1. **Live mode (online)** — When the app has connectivity, it behaves just like the web browser does today: WebSocket connection to `/ws/sync`, real-time push/pull of changes as they happen. Edits on the phone appear on the desktop instantly and vice versa. Same immediate sync the web app already does.

2. **Offline mode** — When connectivity drops, the app queues all changes locally. On reconnect, it flushes the queue (push dirty changes, pull missed changes) and then re-establishes the WebSocket for live mode.

The transition between modes should be seamless and automatic. The user shouldn't have to think about it — they just use the app, and it's always up to date when it can be.

> **⭐ Recommendation: Use Android's ConnectivityManager + WorkManager for mode transitions.**
>
> ConnectivityManager tells you when network state changes. WorkManager handles the "flush queue on reconnect" job with automatic retry and backoff. The WebSocket connection (OkHttp's built-in WebSocket client) handles live mode. Pattern: WorkManager enqueues a one-time sync job whenever connectivity returns → job pushes dirty records, pulls changes → on success, opens WebSocket for live updates. If the WebSocket drops, fall back to periodic polling (every 30s) until it reconnects.

**Sync protocol design:**
- Each chit gets a `modified_datetime` (already exists!) and a monotonically increasing `sync_version` (new)
- Client tracks: `last_sync_timestamp` — the high-water mark of what it's seen from the server
- Live mode: WebSocket delivers changes in real-time (same as current web app sync hub)
- Reconnect/catch-up: client sends all locally-dirty chits; server responds with all chits modified since client's last sync
- Server needs a new endpoint: `GET /api/sync/changes?since={timestamp}&user_id={id}` → returns all chits (including soft-deleted) modified after that timestamp
- Client needs a new endpoint to push: `POST /api/sync/push` → accepts a batch of chit updates with their local timestamps
- On reconnect, the app does a full catch-up sync first, THEN opens the WebSocket for live updates going forward

**Edge cases to handle:**
- ~~Chit created offline, then same chit created on web (ID collision)~~ — ✅ Already using UUIDs, no collision possible
- Chit deleted on one side, edited on the other
- Checklist items reordered on both sides simultaneously
- Tags renamed on server while client has chits using old tag name
- Settings changed on both sides

> **⭐ Recommendation on edge cases:**
>
> - **~~ID collision:~~** ✅ Already solved — both sides generate UUIDs independently.
> - **Delete vs. edit conflict:** Delete wins. If something was deleted on either side, it stays deleted. The edit is lost. This matches user intent — deletion is a deliberate act. Log it in audit so you can see what was lost.
> - **Checklist reorder:** Treat the entire checklist JSON as a single field for conflict purposes. LWW on the whole checklist blob. Merging individual item positions across two different orderings is a rabbit hole not worth entering.
> - **Tag renames:** Tags are strings on chits. If a tag is renamed on the server, push the rename as a separate sync event that the client applies to all local chits bearing that tag. Add a `tag_renames` table on the server to track these.
> - **Settings conflicts:** LWW, full stop. Settings change rarely and there's only one "correct" state.
> - **All conflicts:** Write an audit entry with both versions. Set `has_unviewed_conflict = true` on the chit. Next time the user opens it, they see the banner and can drill into the audit log to review/cherry-pick.

### 4. Server-Side Changes

The existing server needs modifications to support the sync protocol:

- **~~UUID primary keys~~** — ✅ Already done! Both chits and contacts already use `uuid4()` for ID generation. No migration needed.
- **Sync version column** — add `sync_version INTEGER` to chits table, auto-incremented on every write
- **New sync API endpoints** — pull changes, push changes, resolve conflicts
- **Conflict audit entries** — when a sync conflict is resolved, write both versions to the audit log so the user can review and cherry-pick later
- **Tombstone tracking** — soft deletes already exist, but you need to keep them around long enough for all clients to sync (can't purge trash immediately)
- **Multi-device awareness** — track which devices have synced up to which version, so you can tell a device "you're 47 changes behind"

> **⭐ Recommendation: The UUID migration is already done — that's a huge head start.**
>
> The remaining server work is straightforward:
> 1. Add `sync_version` column (standard migration pattern you already use)
> 2. Add `has_unviewed_conflict` boolean column to chits
> 3. Create a `device_tokens` table (id, user_id, device_name, token, last_seen_at, last_sync_version)
> 4. Build 2-3 new API endpoints for sync pull/push
> 5. Extend the existing audit log to store sync conflict entries with both versions
>
> **On tombstone retention:** Add a `purge_after` datetime to soft-deleted records. Don't hard-delete anything until all registered devices have synced past that deletion. A 90-day retention window is safe — if a device hasn't synced in 90 days, it gets a full re-sync on next connect.

### 5. Web App — Stays As-Is

The web app continues to serve both desktop and mobile browsers. It remains the primary interface for desktop users and a fully functional fallback for anyone who doesn't want to install the Android app.

- Keep all mobile-responsive CSS/JS — the web app's mobile view is still a first-class experience
- The web app stays a thin client hitting the server directly (no offline needed for web)
- Shared API means both clients talk to the same backend
- The existing WebSocket sync hub already handles multi-client real-time updates — the Android app is just another client connecting to it

> **⭐ Recommendation: Don't touch the web app's mobile experience.**
>
> It works, people might prefer it, and it costs nothing to maintain. The Android app is for users who want offline access, native notifications, and a more integrated mobile experience. The web app is for everyone else. Both are valid.

### 6. Authentication & Security

- The Android app needs to authenticate against the server (token-based, probably JWT or a long-lived API key per device)
- Tokens need to survive app restarts (stored in Android Keystore)
- Sync traffic should be encrypted (HTTPS — already using self-signed certs with Tailscale)
- Device registration: server should know which devices are syncing (for conflict resolution and "last synced" tracking)

> **⭐ Recommendation: Long-lived device tokens, not JWTs.**
>
> JWTs expire and need refresh flows, which add complexity when the app is offline (token expires while offline → can't sync on reconnect until re-auth). Instead:
> - On first login, the app authenticates with username/password and receives a device-specific API token (a random 256-bit string stored in a `device_tokens` table on the server).
> - That token never expires unless explicitly revoked.
> - Store it in Android's EncryptedSharedPreferences (backed by Keystore).
> - The server's `device_tokens` table tracks: token, user_id, device_name, created_at, last_seen_at. This gives you the "which devices are syncing" visibility for free.
> - Revocation: add a "Manage Devices" section in web app settings where you can see all registered devices and revoke any token.

---

## Scale & Scope Estimate

| Component | Effort | Notes |
|---|---|---|
| Android app shell + navigation | Medium | Screens, routing, theming |
| Local SQLite database + Room DAOs | Medium | Schema mirroring, migrations |
| All C CAPTN views rendered natively | **Large** | Calendar alone is complex; 6+ distinct view types |
| Offline CRUD | Medium | Standard Room/ViewModel pattern |
| Sync engine (client side) | **Large** | Conflict resolution, queue management, retry logic |
| Sync API (server side) | Medium | New endpoints, version tracking |
| ~~UUID migration (server)~~ | ~~Done~~ | ✅ Already using uuid4() |
| Local notifications | Medium | Android alarm manager, notification channels |
| Attachments sync | Medium | Download queue, upload queue, cache management |
| Settings/contacts sync | Small-Medium | Simpler than chits (less conflict potential) |
| Auth/device management | Small-Medium | Token storage, device registration |
| Testing & edge cases | **Large** | Sync bugs are subtle and data-destructive |

> **⭐ Recommendation on effort with LLM assistance:**
>
> Using Claude/Qwen/DeepSeek to generate code will dramatically speed up the "write the code" part of each component. Where you'll still spend real time:
> - **Architecture decisions** — the LLM can't decide your sync strategy for you, it can only implement what you specify
> - **Integration testing** — sync bugs manifest at the boundary between components, not within them. You'll need to manually test scenarios like "edit on phone, airplane mode, edit same chit on web, reconnect"
> - **Debugging sync state** — when something goes wrong, you'll be staring at two databases trying to figure out why they diverged
>
> Revised estimate with LLM assistance: **2-4 months** instead of 3-6. The LLM cuts boilerplate time in half but doesn't reduce debugging/integration time.

**Total estimate:** 2-3 months for a solo developer with heavy LLM assistance. The UUID migration being already done removes what would have been 2-3 weeks of the scariest prerequisite work. The sync engine is still the long pole — not because the code is hard to write, but because the edge cases are hard to find and fix.

---

## Key Decisions — With Recommendations

### 1. Native vs. cross-platform?

> **⭐ Recommendation: Kotlin + Jetpack Compose (native Android).**
>
> You said Android. Go native. LLMs generate excellent Kotlin/Compose code. The ecosystem is stable, well-documented, and won't break under you. If iOS becomes a goal later, Kotlin Multiplatform (KMP) lets you share the sync engine, data layer, and business logic while writing SwiftUI for the iOS UI layer. That's a better path than Flutter or React Native for a project this data-heavy.

### 2. UUID migration now or later?

> **⭐ Recommendation: Already done! ✅**
>
> Both chits and contacts already use `str(uuid4())` for ID generation. No migration needed. This removes what would have been the single biggest prerequisite task. You can start the Android app knowing that locally-generated UUIDs will never collide with server-generated ones.

### 3. How much UI parity?

> **⭐ Recommendation: Start with Tasks + Notes + Calendar (day/week view only). Add the rest incrementally.**
>
> These three cover 80% of daily use. Checklists, Projects (Kanban), and Alerts can come in Phase 4. The editor (create/edit a chit) is the critical path — get that right first, then build out the views. Don't try to ship all 6 C CAPTN views in v1.

### 4. Sync granularity — whole-chit vs. field-level?

> **⭐ Recommendation: Field-level tracking, whole-chit transfer.**
>
> Track which fields changed locally (store a `dirty_fields` JSON array per dirty record). Transfer the whole chit JSON on sync (it's small — a few KB at most). But use the dirty_fields metadata on the server to do field-level merge: only overwrite fields that the client actually changed. This gives you the merge benefits without the complexity of partial-record transfer.

### 5. Conflict UX?

> **⭐ Recommendation: Silent LWW + notification banner + audit log drill-down.**
>
> Don't interrupt the user at sync time. Resolve automatically (latest timestamp wins per field). But the next time the user opens a chit that had a conflict, show a dismissible banner: "⚠️ Sync conflict resolved — [View in audit log]". The audit log entry preserves both the local and server versions of every conflicting field, and provides a UI to cherry-pick values from either version. This gives you zero-friction daily use with full recoverability when it matters.

### 6. Shared code between web and mobile?

> **⭐ Recommendation: Don't try to share code. Share the API contract instead.**
>
> The web app is vanilla JS. The Android app is Kotlin. There's no practical way to share code between them. What you share is the API — same endpoints, same JSON shapes, same sync protocol. Document the API contract clearly (consider an OpenAPI spec) and both clients implement against it independently. The LLM can generate the Kotlin data classes directly from your Pydantic models — just feed it `models.py` and ask for Room entities.

---

## Suggested Phasing

**Phase 0: Server prep** (do this while the web app is still the only client)
- ~~Migrate to UUID primary keys~~ ✅ Already done
- Add sync_version column
- Build sync API endpoints (`/api/sync/changes`, `/api/sync/push`)
- Add `device_tokens` table and device auth
- Add `has_unviewed_conflict` flag to chits table
- Extend audit log to store sync conflict entries with both versions
- Keep web app working throughout

> **⭐ Recommendation: Budget 1-2 weeks for Phase 0.** No UUID migration needed (already done!). The sync endpoints are straightforward FastAPI routes. The device token system is a simple table + auth middleware check.

**Phase 1: Read-only Android app**
- App authenticates, pulls all chits, displays them
- No local edits yet — just a native viewer
- Validates the sync-pull mechanism
- Establish the app's visual identity and navigation structure

> **⭐ Recommendation: Budget 2-3 weeks.** This is where you establish the app's architecture — dependency injection (Hilt), navigation (Compose Navigation), theming, and the Room database. Get this foundation right because everything builds on it. An LLM can scaffold all of this quickly, but you'll want to review the architecture choices carefully.

**Phase 2: Offline CRUD + Live Sync**
- Local database, dirty tracking
- Create/edit/delete chits offline
- WebSocket connection for live sync when online
- Push changes on reconnect (WorkManager)

> **⭐ Recommendation: Budget 3-4 weeks.** This is the core of the app's value proposition. The chit editor UI + sync engine together. Test heavily: create offline, edit offline, delete offline, reconnect, verify server state matches.

**Phase 3: Full bidirectional sync**
- Conflict detection and resolution
- Multi-device awareness
- Attachments, contacts, settings sync
- Notifications (local alarms via AlarmManager)

> **⭐ Recommendation: Budget 3-4 weeks.** Conflicts are rare in practice (single user) but you still need the code paths. Attachments are the wildcard — large file sync adds complexity. Consider deferring attachment sync to Phase 4 if it's slowing you down.

**Phase 4: Feature parity**
- Remaining C CAPTN views (Checklists, Projects/Kanban, Alerts, Indicators)
- Maps integration (Android MapView + your existing geocoding)
- Polish, animations, edge cases
- Widget for home screen (quick-add chit, today's calendar)

> **⭐ Recommendation: This phase is open-ended.** Ship after Phase 3 with the core views working. Phase 4 is ongoing improvement, not a gate to "done."

---

---

## Getting Started — The Hello World Stuff

If you've never built an Android app before, here's what you actually need:

### What to Install (on your Mac)

1. **Android Studio** — Free download from [developer.android.com](https://developer.android.com/studio). This is the IDE (like VS Code but for Android). It includes the Android SDK, emulator, and build tools. ~2GB download, ~8GB installed.

2. **JDK** — Android Studio bundles one, but you may want a standalone JDK 17+ (via `brew install openjdk@17` if you use Homebrew).

That's it for development. You can build and test entirely on the emulator without a physical device.

### Do You Need a Google Developer Account?

- **For development and personal use: No.** You can build the APK in Android Studio and sideload it onto your own phone (enable "Install from unknown sources" in Android settings). Since CWOC is a personal/self-hosted tool, you probably never need to publish to the Play Store.

- **For Play Store distribution: Yes.** A Google Play Developer account costs a one-time $25 fee. You'd need this only if you wanted to distribute the app to other people via the Play Store. Given CWOC is self-hosted and personal, this is likely unnecessary.

- **⭐ Recommendation: Skip the developer account. Build the APK, sideload it to your phone.** You can always publish later if you want to. For a personal tool on your own device, sideloading is fine.

### First Steps (What to Tell the LLM)

When you're ready to start, give the LLM this prompt to scaffold the project:

> "Create a new Android app project using Kotlin and Jetpack Compose. Target API 26+ (Android 8.0+). Set up:
> - Hilt for dependency injection
> - Room for local SQLite database
> - Retrofit + OkHttp for API calls
> - Compose Navigation for screen routing
> - Material 3 theming with custom colors (browns/parchment: primary #6b4e31, background #fffaf0, surface #f5e6d3)
> - A basic login screen that authenticates against `https://<server>/api/auth/login`
>
> Project name: CWOC, package: com.cwoc.app"

That gives you the skeleton. From there you build screen by screen.

### Project Structure (What an Android App Looks Like)

```
app/
  src/main/
    java/com/cwoc/app/
      di/                  # Dependency injection modules (Hilt)
      data/
        local/             # Room database, DAOs, entities
        remote/            # Retrofit API service, DTOs
        repository/        # Repository pattern (combines local + remote)
        sync/              # Sync engine (WorkManager jobs, conflict resolution)
      ui/
        theme/             # Colors, typography, shapes (parchment theme)
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
    AndroidManifest.xml    # App permissions, activities
  build.gradle.kts         # Dependencies, SDK versions
```

### Key Android Concepts (Quick Reference)

- **Activity** — A single screen container. Modern apps typically have ONE activity and use Compose Navigation for multiple screens.
- **ViewModel** — Holds UI state, survives screen rotation. Each screen gets one.
- **Repository** — Mediates between local DB and remote API. The sync logic lives here.
- **WorkManager** — Schedules background work (sync jobs) that survives app restarts and respects battery/network constraints.
- **Hilt** — Dependency injection. Wires everything together so you don't pass objects around manually.
- **Room** — SQLite wrapper. You define entities (tables) and DAOs (queries) as Kotlin classes/interfaces, Room generates the implementation.

---

## Open Questions — With Recommendations

**Do you want iOS eventually?**
> **⭐ Recommendation: Very low priority. Don't factor it into any decisions now.**
>
> Build for Android. If iOS ever becomes real (years from now), the data/sync layer can be extracted into a Kotlin Multiplatform (KMP) module and you'd write SwiftUI for the iOS UI. But don't let a hypothetical future iOS app influence your Android technology choices today. Go fully native Android without compromise.

**Is the 1940s parchment theme carrying over to the app?**
> **⭐ Recommendation: Yes, but adapted for native.** Use Material 3 (Material You) as the structural foundation (navigation, cards, buttons, sheets) but skin it with your parchment colors, Lora font, and brown tones. This gives you proper Android UX patterns (back gestures, bottom nav, pull-to-refresh) while keeping the CWOC identity. Don't try to make the app look like a web page — make it look like a native app that happens to share CWOC's color palette and typography.

**How much JS logic needs rewriting?**
> **⭐ Recommendation: Feed the JS to the LLM and ask it to port to Kotlin.** Recurrence expansion, tag tree building, checklist nesting logic — these are all pure functions with no DOM dependency. Give Claude your `shared-recurrence.js`, `shared-tags.js`, and `shared-checklist.js` and ask for Kotlin equivalents. The logic ports cleanly; it's just syntax translation. Budget a day or two for this, not weeks.

**Would a PWA with service workers be "good enough"?**
> **⭐ Recommendation: No. Build the native app.**
>
> PWA offline support is fragile — service workers have storage limits, can be evicted by the OS, and IndexedDB performance degrades with large datasets. You have potentially thousands of chits with rich metadata. A native app with Room/SQLite gives you reliable, fast, unlimited local storage. Plus: native notifications, background sync via WorkManager, home screen widgets, proper back-gesture handling, and no "Add to Home Screen" friction. The PWA path saves maybe 4 weeks of effort but gives you a permanently inferior experience. The web app (which already works on mobile browsers) remains available for anyone who doesn't want to install the native app — that covers the "I don't want to install anything" crowd.

**What's the minimum viable feature set?**
> **⭐ Recommendation: The MVP is:**
> - Authentication + device registration
> - Full chit list (all chits, searchable/filterable)
> - Chit editor (create, edit, delete — all fields)
> - Tasks view (status-based filtering)
> - Notes view (markdown rendering)
> - Calendar view (day + week)
> - Offline CRUD + sync on reconnect
> - Live sync via WebSocket when online
>
> That's your "I can use this as my daily driver" threshold. Everything else is enhancement.
