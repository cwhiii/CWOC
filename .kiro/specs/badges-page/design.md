# Design Document

## Architecture Overview

The Badges Page feature spans all three layers: backend (Python/FastAPI), web frontend (vanilla JS/HTML/CSS), and Android app (Kotlin/Compose). The backend is the source of truth — it detects, persists, deduplicates, and auto-completes badges. The web frontend and Android app are consumers that display badge data and allow dismissal.

```
┌─────────────────────────────────────────────────────────┐
│                    Backend (Python)                       │
│                                                          │
│  Email Ingestion → Smart Link Detection → badges table   │
│  Background Scheduler → Completion Logic                 │
│  /api/badges (GET) → returns active + recent completed   │
│  /api/badges/{id}/dismiss (POST) → marks dismissed       │
└──────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          │                         │
┌─────────▼─────────┐   ┌──────────▼──────────┐
│   Web Frontend     │   │   Android App        │
│                    │   │                      │
│  badges.html       │   │  BadgesScreen        │
│  badges.js         │   │  BadgesViewModel     │
│  Sidebar controls  │   │  Room cache (badges) │
│  Fetch & render    │   │  Offline support     │
└────────────────────┘   └─────────────────────┘
```

## Database Schema

### New Table: `badges`

```sql
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    chit_id TEXT NOT NULL,
    category TEXT NOT NULL,
    provider_name TEXT NOT NULL,
    code TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    detected_at TEXT NOT NULL,
    last_updated_at TEXT NOT NULL,
    completed_at TEXT,
    last_email_subject TEXT,
    UNIQUE(provider_name, code)
);
CREATE INDEX IF NOT EXISTS idx_badges_status ON badges(status);
CREATE INDEX IF NOT EXISTS idx_badges_category ON badges(category);
CREATE INDEX IF NOT EXISTS idx_badges_provider_code ON badges(provider_name, code);
```

### Settings Addition

Add `badges_completed_window` field to user settings (default: `"3"`). Stored as string representing days, or `"all"`.

## Backend Design

### Badge Detection (in email ingestion pipeline)

When an email chit is created or updated (via `/api/chits` POST/PUT or email sync), run the smart link detection logic server-side:

1. Import the detector registry (same patterns as `shared-smart-links.js` but in Python)
2. Run all enabled detectors against the email text (subject + body + from)
3. For each match, UPSERT into `badges` table using `(provider_name, code)` as the dedup key
4. On insert: set status=active, detected_at=now, last_updated_at=now
5. On update: set last_updated_at=now, last_email_subject=new subject, chit_id=new chit id

### Completion Logic

**Email-based completion (runs during detection):**
- When processing a Package badge and the email text contains delivery keywords ("delivered", "delivery complete", "has been delivered", "was delivered"), set status=completed, completed_at=now

**Date-based completion (background scheduler):**
- Run periodically (same interval as weather, e.g., every 30 minutes)
- For Flight badges: check if associated chit's start_datetime has passed → complete
- For Hotel badges: check if associated chit's end_datetime has passed → complete
- For Event badges: check if associated chit's start_datetime has passed → complete
- For Rental badges: check if associated chit's end_datetime has passed → complete

### API Endpoints

**`GET /api/badges?completed_window=3`**
- Returns all badges with status=active
- Plus badges with status in (completed, dismissed) where completed_at is within the window
- `completed_window` param: number of days, or "all" for no filter
- Response: `{ "badges": [...], "counts": { "active": N, "completed": N } }`

**`POST /api/badges/{id}/dismiss`**
- Sets status=dismissed, completed_at=now
- Returns updated badge object

### Detector Registry (Python)

Port the `_smartLinkDetectors` array from `shared-smart-links.js` to a Python module (`src/backend/badge_detectors.py`). Same structure: category, name, keywords (as regex patterns), extraction regex, URL template, label, icon, priority.

Load user's `smart_actions_config` from settings to respect disabled detectors/categories and include custom detectors.

## Web Frontend Design

### Page Structure

`/frontend/html/badges.html`:
- Uses `shared-page.css` + `shared-page.js` pattern
- `data-page-title="Badges"` and `data-page-icon="🛡️"` and `data-sidebar="true"`
- Loads: shared scripts → `badges.js`

### Layout

```
┌─────────────────────────────────────────────┐
│  [Sidebar]  │  Main Content                  │
│             │                                │
│  Recently   │  ── 📦 Package ──────────────  │
│  Completed: │  [Badge Card] [Badge Card]     │
│  [3 days ▼] │                                │
│             │  ── ✈️ Flight ───────────────  │
│  [🔄 Refresh]│  No active flights            │
│             │                                │
│             │  ── 🏨 Hotel ────────────────  │
│             │  [Badge Card]                  │
│             │                                │
│             │  ── Recently Completed ──────  │
│             │  [Completed Card] [Dismissed]  │
└─────────────────────────────────────────────┘
```

### Badge Card Structure

```
┌──────────────────────────────────────────┐
│ [icon] Provider Name        ⏱️ 3d    [✕] │
│ CODE-12345                               │
│ "Your package has shipped"               │
│ [Track ↗]              [📝 View Chit]    │
└──────────────────────────────────────────┘
```

- Icon: provider SVG from `/static/tracking/`
- Staleness: relative time, hover shows exact datetime
- [✕]: dismiss button
- [Track ↗]: opens external URL in new tab
- [📝 View Chit]: navigates to editor with source chit

### Sidebar

- "Recently Completed" dropdown (1 day, 3 days, 1 week, 1 month, 1 year, All)
- "🔄 Refresh" button — calls `/api/email/check` then re-fetches `/api/badges`
- Spinner shown during refresh

### JavaScript (`badges.js`)

- On load: fetch settings (for 24h mode + completed_window), fetch `/api/badges`
- Render category sections with cards
- Staleness calculation: compare `last_updated_at` to now, format as Xm/Xh/Xd
- Hover tooltip: format `last_updated_at` using 24h or 12h based on settings
- Dismiss: POST to `/api/badges/{id}/dismiss`, remove card from DOM with animation
- Refresh: show spinner, POST `/api/email/check`, wait, GET `/api/badges`, re-render

## Android App Design

### New Files

- `Screen.Badges` in `Screen.kt`
- `ui/screens/badges/BadgesScreen.kt` — Composable UI
- `ui/screens/badges/BadgesViewModel.kt` — ViewModel
- `data/local/entity/BadgeEntity.kt` — Room entity
- `data/local/dao/BadgeDao.kt` — Room DAO
- Navigation entry in `CwocNavGraph.kt`
- Sidebar button in `SidebarContent.kt`

### Room Entity

```kotlin
@Entity(tableName = "badges")
data class BadgeEntity(
    @PrimaryKey val id: String,
    val chitId: String,
    val category: String,
    val providerName: String,
    val code: String,
    val url: String,
    val icon: String?,
    val label: String,
    val status: String,  // "active", "completed", "dismissed"
    val detectedAt: String,
    val lastUpdatedAt: String,
    val completedAt: String?,
    val lastEmailSubject: String?,
    val cachedAt: String  // when this was last fetched from server
)
```

### ViewModel Pattern

```kotlin
@HiltViewModel
class BadgesViewModel @Inject constructor(
    private val apiService: CwocApiService,
    private val badgeDao: BadgeDao,
    private val settingsRepository: SettingsRepository,
    private val connectivityMonitor: ConnectivityMonitor
) : ViewModel() {
    // Expose cached badges as Flow from Room
    // On init: if online, fetch from API and update cache
    // If offline: show cached data + offline indicator
    // Dismiss: update local cache immediately, queue API call
}
```

### Offline Behavior

- Show cached badges from Room
- Display subtle banner: "📡 Offline — showing cached data"
- Dismiss actions update local Room immediately (optimistic)
- When online returns: re-fetch from server, send any queued dismiss calls

### Navigation

- Add `Screen.Badges` to sealed class
- Add composable in `CwocNavGraph`
- Add "🛡️ Badges" button in `SidebarContent.kt` quick-access section

## Migration

### Backend (SQLite)

New migration in `migrations.py`:
```python
def migrate_add_badges_table():
    """Create badges table for persisted smart link detections."""
    # CREATE TABLE IF NOT EXISTS badges (...)
    # CREATE INDEX IF NOT EXISTS ...
```

New setting field: `badges_completed_window` (add column to settings if not exists).

### Android (Room)

New Room migration creating the `badges` table. Follow the standard migration pattern with date-prefixed filename.

## Settings Sync

The `badges_completed_window` field is added to the settings entity. It syncs through the existing settings sync pipeline (server → SyncEngine → SettingsEntity). No new sync entity type needed for badges themselves — they're fetched on-demand via the API.

## Web Sidebar Integration

Add "🛡️ Badges" button to:
- Dashboard sidebar (in `shared-sidebar.js` or equivalent)
- Hotkey panel navigation options
- The badges page's own sidebar (for page-specific controls)
