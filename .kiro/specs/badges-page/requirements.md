# Requirements Document

## Introduction

The Badges Page is a dedicated view that consolidates all active and recently-completed "smart link" detections (package tracking, flights, hotels, rental cars, events, restaurants, transit, orders) into a single command-center page. Currently, badges are detected on-the-fly when rendering email cards and are ephemeral. This feature persists detected badges server-side, auto-completes them based on subsequent emails or date logic, and presents them in a categorized, always-accessible page across all platforms (web desktop, web mobile, Android app).

The page shows what's currently in-flight (active badges) and what recently finished (completed badges within a configurable window). Badges are deduplicated by provider+code, updated when new emails reference the same code, and include a staleness indicator showing how long since the last update. Users can manually dismiss badges and refresh email to get the latest state.

## Glossary

- **Badge**: A persisted record of a detected smart link — represents a single trackable item (a package, a flight, a hotel booking, etc.) with its current status.
- **Badge_Status**: One of `active`, `completed`, or `dismissed`. Active badges are in-flight; completed badges have reached their end state; dismissed badges are manually hidden by the user.
- **Staleness_Indicator**: A relative time display (e.g., "⏱️ 3d") showing how long since the badge was last updated. Hover/long-press shows the exact datetime respecting the user's 24-hour time preference.
- **Completion_Logic**: Rules that automatically transition a badge from active to completed — based on keywords in subsequent emails (e.g., "delivered") or date-based logic (flight departure passed, hotel checkout passed, event date passed).
- **Deduplication**: When the same provider+code combination is detected in multiple emails, the existing badge is updated rather than creating a duplicate.
- **Recently_Completed_Window**: A user-configurable time window (1 day, 3 days, 1 week, 1 month, 1 year, all) controlling how far back completed badges are shown. Persisted in settings. Default: 3 days.
- **Badge_Cache**: A local Room database table on the Android app that stores badge data for offline access.

## Requirements

### Requirement 1: Badge Persistence & Detection

**User Story:** As a user, I want detected smart links to be saved automatically so I can see all my active trackable items in one place without re-scanning emails every time.

#### Acceptance Criteria

1. WHEN an email is ingested or synced, THE server SHALL run smart link detection against the email text and persist any matches to the `badges` table
2. THE badge record SHALL include: unique ID, source chit ID, category, provider name, detected code, action URL, icon path, button label, status (active/completed/dismissed), detected_at timestamp, last_updated_at timestamp, completed_at timestamp (nullable), and last_email_subject (most recent email mentioning this code)
3. WHEN the same provider+code combination is detected in a new email, THE server SHALL update the existing badge's `last_updated_at`, `last_email_subject`, and `chit_id` (to point to the most recent email) rather than creating a duplicate
4. WHEN a badge is first created, THE server SHALL set its status to `active`

### Requirement 2: Automatic Completion

**User Story:** As a user, I want badges to automatically mark themselves as completed when the tracked item reaches its end state, so I don't have to manually manage them.

#### Acceptance Criteria

1. WHEN a subsequent email for a Package badge contains delivery-related keywords (delivered, delivery complete, has been delivered), THE server SHALL set the badge status to `completed` and record `completed_at`
2. WHEN a Flight badge's associated departure datetime has passed, THE background scheduler SHALL set the badge status to `completed`
3. WHEN a Hotel badge's associated checkout date has passed, THE background scheduler SHALL set the badge status to `completed`
4. WHEN an Event badge's associated event date has passed, THE background scheduler SHALL set the badge status to `completed`
5. WHEN a Rental badge's associated return date has passed, THE background scheduler SHALL set the badge status to `completed`
6. THE background scheduler SHALL run completion checks periodically (same interval as weather polling)

### Requirement 3: Manual Dismissal

**User Story:** As a user, I want to manually dismiss a badge that I no longer care about, so it stops appearing in my active view.

#### Acceptance Criteria

1. WHEN a user clicks the dismiss button on a badge card, THE system SHALL set the badge status to `dismissed` and record `completed_at`
2. A dismissed badge SHALL NOT appear in the active section
3. A dismissed badge SHALL appear in the recently-completed section (within the configured window) with a visual indicator that it was manually dismissed
4. THE dismiss action SHALL be available on all platforms (web and Android app)
5. WHEN the Android app is offline, THE dismiss action SHALL be queued locally and sent to the server when connectivity returns

### Requirement 4: Badges Page — Web (Desktop & Mobile)

**User Story:** As a user, I want a dedicated page where I can see all my active and recently-completed badges organized by category, so I have a single command center for everything in-flight.

#### Acceptance Criteria

1. THE Badges page SHALL be accessible at `/frontend/html/badges.html` and follow the shared-page pattern (shared-page.css, shared-page.js, sidebar via `data-sidebar="true"`)
2. THE page SHALL display badges grouped by category sections: Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order
3. EACH category section SHALL always be visible — empty categories show "No active [category name]" message
4. EACH badge card SHALL display: provider icon, provider name, detected code, last email subject, staleness indicator (⏱️ Xd format), action button (Track/Manage/View linking to external URL), link to source chit (opens editor), and dismiss button
5. THE staleness indicator SHALL show relative time (e.g., "⏱️ 3d", "⏱️ 2h") and on hover SHALL show the exact datetime of the last update, respecting the user's 24-hour time format setting
6. WITHIN each category section, badges SHALL be sorted by last_updated_at descending (most recently updated at top)
7. THE page SHALL show a "Recently Completed" section below active badges, filtered by the user's configured window
8. THE page SHALL be mobile-responsive from the start

### Requirement 5: Sidebar Controls

**User Story:** As a user, I want sidebar controls on the Badges page to filter completed badges and refresh data, so I can control what I see and get the latest information.

#### Acceptance Criteria

1. THE sidebar SHALL contain a "Recently Completed" dropdown with options: 1 day, 3 days (default), 1 week, 1 month, 1 year, All
2. THE selected window value SHALL be persisted in user settings and restored on page load
3. THE sidebar SHALL contain a "Refresh" button that triggers an email check (`/api/email/check`) AND re-fetches badge data, showing a spinner while working
4. THE sidebar SHALL contain navigation back to the dashboard

### Requirement 6: API Endpoints

**User Story:** As a developer, I want clean API endpoints for badge data so all platforms can access the same information consistently.

#### Acceptance Criteria

1. `GET /api/badges` SHALL return all active badges plus completed badges within the requested window, accepting a `completed_window` query parameter (days, or "all")
2. `POST /api/badges/{id}/dismiss` SHALL set the badge status to `dismissed` and return the updated badge
3. `GET /api/badges` response SHALL include badge objects with all fields needed for rendering (id, chit_id, category, provider_name, code, url, icon, label, status, detected_at, last_updated_at, completed_at, last_email_subject)
4. THE API SHALL require authentication (same auth pattern as other endpoints)

### Requirement 7: Settings Integration

**User Story:** As a user, I want my badges page preferences to persist across sessions so I don't have to reconfigure them each time.

#### Acceptance Criteria

1. THE `badges_completed_window` setting SHALL be stored in the user settings table with a default value of "3" (days)
2. WHEN the user changes the Recently Completed dropdown, THE frontend SHALL save the new value to settings
3. THE setting SHALL sync to the Android app via the normal settings sync pipeline

### Requirement 8: Android App — Native Badges Screen

**User Story:** As a user, I want to see my badges on the Android app with full offline support, so I can check my tracking info even in airplane mode.

#### Acceptance Criteria

1. THE Android app SHALL have a native Kotlin/Compose `BadgesScreen` accessible from the sidebar navigation
2. THE app SHALL fetch badge data from `GET /api/badges` when online and persist it in a local Room table (`badges` entity)
3. WHEN offline, THE app SHALL display cached badge data with a subtle "offline — data may be stale" indicator
4. WHEN connectivity returns, THE app SHALL automatically refresh badge data from the server
5. THE dismiss action SHALL work offline by queuing the request and sending it when connectivity returns
6. THE staleness indicator on long-press SHALL show the exact datetime respecting the user's 24-hour time setting
7. THE badges screen SHALL display categories, cards, and controls matching the web version's functionality
8. THE sidebar SHALL include a 🛡️ Badges navigation button

### Requirement 9: Navigation & Discoverability

**User Story:** As a user, I want to easily find and navigate to the Badges page from anywhere in the app.

#### Acceptance Criteria

1. THE web sidebar SHALL include a "🛡️ Badges" button in the quick-access section (alongside Maps, Weather, etc.)
2. THE web hotkey panel SHALL include a Badges entry for keyboard navigation
3. THE Android sidebar SHALL include a "🛡️ Badges" button that navigates to the BadgesScreen
4. THE page title and icon SHALL be "🛡️ Badges" consistently across all platforms

### Requirement 10: Staleness & Time Display

**User Story:** As a user, I want to know how fresh my badge information is at a glance, so I can decide whether to check the external service for updates.

#### Acceptance Criteria

1. THE staleness indicator SHALL display as "⏱️ Xm" (minutes), "⏱️ Xh" (hours), or "⏱️ Xd" (days) based on time since last_updated_at
2. WHEN the user hovers (web) or long-presses (mobile/app) the staleness indicator, THE system SHALL show a tooltip with the exact date and time of the last update
3. THE tooltip datetime format SHALL respect the user's 24-hour time preference from settings (e.g., "May 28, 2026 14:30" vs "May 28, 2026 2:30 PM")
4. WHEN a badge has not been updated in more than 7 days, THE staleness indicator SHALL use a warning color to signal potentially outdated information
