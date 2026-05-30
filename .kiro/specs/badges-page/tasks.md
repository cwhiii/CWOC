# Implementation Plan

## Overview
Implement the Badges Page feature across all platforms (backend, web frontend, Android app). This creates a dedicated view consolidating all active and recently-completed smart link detections into a categorized command-center page.

## Tasks

- [x] 1. Backend — Database Migration & Badge Table
  - [x] 1.1. Add `migrate_add_badges_table()` to `src/backend/migrations.py` creating the `badges` table with columns: id, chit_id, category, provider_name, code, url, icon, label, status, detected_at, last_updated_at, completed_at, last_email_subject
  - [x] 1.2. Add UNIQUE constraint on (provider_name, code)
  - [x] 1.3. Add indexes on status, category, and (provider_name, code)
  - [x] 1.4. Add `badges_completed_window` column to settings table (default "3")
  - [x] 1.5. Register migration call in `main.py` startup sequence

- [x] 2. Backend — Python Detector Registry
  - [x] 2.1. Create `src/backend/badge_detectors.py` with the detector registry ported from `shared-smart-links.js`
  - [x] 2.2. Include all built-in detectors: Package (UPS, FedEx, USPS, DHL, Amazon, UniUni, OnTrac, LaserShip), Flight, Hotel (Marriott, Hilton, IHG, Hyatt, Airbnb, Booking.com, VRBO, Wyndham), Rental (Enterprise, Hertz, Avis/Budget, Turo), Event (Ticketmaster, Eventbrite, AXS, StubHub, SeatGeek), Restaurant (OpenTable, Resy), Transit (Uber, Lyft), Order (Amazon, Apple, Best Buy, Walmart, Target)
  - [x] 2.3. Implement `detect_badges(chit, settings)` function that runs all enabled detectors against email text fields (subject + body_text + from) and returns list of matches
  - [x] 2.4. Respect user's `smart_actions_config` for disabled detectors/categories and custom detectors
  - [x] 2.5. Implement deduplication logic: return (provider_name, code) pairs for UPSERT

- [x] 3. Backend — Badge Detection Integration
  - [x] 3.1. Hook badge detection into email ingestion pipeline (when email chits are created/updated via routes)
  - [x] 3.2. On detection match: UPSERT into badges table — insert new or update existing (last_updated_at, last_email_subject, chit_id)
  - [x] 3.3. Implement email-based completion: when a Package badge's new email contains delivery keywords, set status=completed
  - [x] 3.4. Ensure detection runs for both new email creation and email sync updates

- [x] 4. Backend — Background Scheduler for Completion
  - [x] 4.1. Add badge completion check to the existing scheduler system (same pattern as weather polling)
  - [x] 4.2. Implement date-based completion logic: Flight complete when source chit's start_datetime has passed; Hotel complete when source chit's end_datetime has passed; Event complete when source chit's start_datetime has passed; Rental complete when source chit's end_datetime has passed
  - [x] 4.3. Run completion checks at the same interval as weather polling

- [x] 5. Backend — API Endpoints
  - [x] 5.1. Implement `GET /api/badges` endpoint: Accept `completed_window` query param (number of days, or "all"); Return all active badges + completed/dismissed badges within window; Response format: `{ "badges": [...], "counts": { "active": N, "completed": N } }`; Sort by category, then by last_updated_at descending within category
  - [x] 5.2. Implement `POST /api/badges/{id}/dismiss` endpoint: Set status=dismissed, completed_at=now; Return updated badge object
  - [x] 5.3. Add authentication requirement to both endpoints
  - [x] 5.4. Register routes in the appropriate routes module

- [x] 6. Backend — Settings Field
  - [x] 6.1. Add `badges_completed_window` to the Pydantic settings model
  - [x] 6.2. Ensure it's included in settings GET/PUT endpoints
  - [x] 6.3. Ensure it syncs to the Android app via the existing sync pipeline (add to SettingsDto if needed)

- [x] 7. Web Frontend — Badges Page HTML
  - [x] 7.1. Create `src/frontend/html/badges.html` using `_template.html` as base
  - [x] 7.2. Set `data-page-title="Badges"`, `data-page-icon="🛡️"`, `data-sidebar="true"`
  - [x] 7.3. Include shared-page.css, shared-editor.css (for any toggle styles), dashboard sidebar styles
  - [x] 7.4. Add page-specific CSS (badge cards, category sections, staleness indicator, empty states)
  - [x] 7.5. Structure: sidebar region + main content region with category sections

- [x] 8. Web Frontend — Badges Page JavaScript
  - [x] 8.1. Create `src/frontend/js/pages/badges.js`
  - [x] 8.2. On load: fetch user settings (24h mode, completed_window), fetch `GET /api/badges`
  - [x] 8.3. Render category sections (Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order) — always show all, empty state for categories with no badges
  - [x] 8.4. Render badge cards with: provider icon, name, code, last_email_subject, staleness indicator, action button, view-chit link, dismiss button
  - [x] 8.5. Implement staleness calculation: compare last_updated_at to now, format as ⏱️ Xm / ⏱️ Xh / ⏱️ Xd
  - [x] 8.6. Implement hover tooltip on staleness showing exact datetime (respect 24h setting)
  - [x] 8.7. Apply warning color to staleness indicator when > 7 days old
  - [x] 8.8. Implement dismiss: POST to API, remove card with animation, update counts
  - [x] 8.9. Implement "Recently Completed" section below active badges
  - [x] 8.10. Sort badges within each category by last_updated_at descending

- [x] 9. Web Frontend — Sidebar Controls
  - [x] 9.1. Add sidebar content for badges page: "Recently Completed" dropdown (1 day, 3 days, 1 week, 1 month, 1 year, All)
  - [x] 9.2. Load saved value from settings on page load, save on change
  - [x] 9.3. Add "🔄 Refresh" button that: shows spinner, calls `/api/email/check`, waits for completion, re-fetches `/api/badges`, re-renders page
  - [x] 9.4. Add navigation back to dashboard

- [x] 10. Web Frontend — Navigation Integration
  - [x] 10.1. Add "🛡️ Badges" button to the dashboard sidebar quick-access section (in shared-sidebar.js or index.html sidebar)
  - [x] 10.2. Add Badges entry to the hotkey navigation panel in index.html
  - [x] 10.3. Add route handling in backend `health.py` if needed (or serve via StaticFiles)

- [x] 11. Android — Room Entity & DAO
  - [x] 11.1. Create `data/local/entity/BadgeEntity.kt` with fields matching the API response
  - [x] 11.2. Add `cachedAt` field for tracking when data was last fetched
  - [x] 11.3. Create `data/local/dao/BadgeDao.kt` with: getAll(), getByStatus(), upsertAll(), updateStatus(), deleteAll()
  - [x] 11.4. Add BadgeEntity to the Room database class
  - [x] 11.5. Create Room migration for the new badges table (date-prefixed filename)
  - [x] 11.6. Archive previous migration(s) per migration cleanup rules
  - [x] 11.7. Register migration in AppModule

- [x] 12. Android — BadgesViewModel
  - [x] 12.1. Create `ui/screens/badges/BadgesViewModel.kt`
  - [x] 12.2. Expose badges as StateFlow from Room (observe local cache)
  - [x] 12.3. On init: if online, fetch from `GET /api/badges` and update Room cache
  - [x] 12.4. Expose isOffline state from ConnectivityMonitor
  - [x] 12.5. Implement dismiss: update Room immediately (optimistic), queue API POST, send when online
  - [x] 12.6. Implement refresh: call email check endpoint, re-fetch badges, update cache
  - [x] 12.7. Read `badges_completed_window` from SettingsRepository
  - [x] 12.8. Read time format (24h) from SettingsRepository for staleness tooltip

- [x] 13. Android — BadgesScreen Composable
  - [x] 13.1. Create `ui/screens/badges/BadgesScreen.kt`
  - [x] 13.2. Display category sections (Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order)
  - [x] 13.3. Empty categories show "No active [category]" text
  - [x] 13.4. Badge cards show: provider icon, name, code, last email subject, staleness indicator, action button (opens URL in browser), view-chit button (navigates to editor), dismiss button
  - [x] 13.5. Staleness indicator: ⏱️ Xm/Xh/Xd format, long-press shows exact datetime tooltip (respecting 24h setting)
  - [x] 13.6. Warning color on staleness > 7 days
  - [x] 13.7. Recently Completed section below active badges
  - [x] 13.8. Offline banner when not connected
  - [x] 13.9. Pull-to-refresh support

- [x] 14. Android — Navigation & Sidebar
  - [x] 14.1. Add `data object Badges : Screen("badges")` to Screen.kt
  - [x] 14.2. Add composable entry in CwocNavGraph.kt
  - [x] 14.3. Add "🛡️ Badges" button to SidebarContent.kt quick-access section (alongside Maps, Weather, etc.)

- [x] 15. Android — Settings Sync for badges_completed_window
  - [x] 15.1. Add `badgesCompletedWindow` field to SettingsEntity
  - [x] 15.2. Add `badges_completed_window` to SettingsDto
  - [x] 15.3. Add mapping in DtoMappers.kt
  - [x] 15.4. Ensure the field syncs correctly from server to local Room

- [x] 16. Help & Documentation
  - [x] 16.1. Create help file `src/help/badges.md` documenting the Badges page features
  - [x] 16.2. Include: what badges are, how they're detected, category types, staleness indicator, dismiss, refresh, recently completed window, offline behavior on Android
  - [x] 16.3. Add deep-links to Settings → Email (where badge detectors are configured)
  - [x] 16.4. Update any existing help files that reference smart actions/badges to link to the new page

- [x] 17. Index & Version
  - [x] 17.1. Update `src/INDEX.md` with new files (badge_detectors.py, badges route, badges.html, badges.js, Android files)
  - [x] 17.2. Update version number (run `date "+%Y%m%d_%H%M"` and set in src/VERSION)
  - [x] 17.3. Update LATEST file
  - [x] 17.4. Add release notes entry

## Task Dependency Graph
```
1 [Backend — Database Migration & Badge Table]
2 [Backend — Python Detector Registry] -> 1
3 [Backend — Badge Detection Integration] -> 1, 2
4 [Backend — Background Scheduler for Completion] -> 1
5 [Backend — API Endpoints] -> 1
6 [Backend — Settings Field] -> 1
7 [Web Frontend — Badges Page HTML] -> 5
8 [Web Frontend — Badges Page JavaScript] -> 5, 7
9 [Web Frontend — Sidebar Controls] -> 8
10 [Web Frontend — Navigation Integration] -> 7
11 [Android — Room Entity & DAO] -> 5
12 [Android — BadgesViewModel] -> 11
13 [Android — BadgesScreen Composable] -> 12
14 [Android — Navigation & Sidebar] -> 13
15 [Android — Settings Sync for badges_completed_window] -> 6, 11
16 [Help & Documentation] -> 8, 13
17 [Index & Version] -> 16, 10, 14, 15
```

## Notes
- No software installation required — all code is written directly
- Tests are not included per project rules (optional and not a blocker)
- Version update happens only once at the very end (Task 17)
- Android Room migrations must follow the date-prefixed naming and archive rules
