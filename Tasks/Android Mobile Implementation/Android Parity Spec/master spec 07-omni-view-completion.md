# Phase 7: Omni View Completion

## Problem
The Omni View screen currently shows 6 sections (Chrono Anchored, Reminders, On Deck, Soon, Pinned Notes, Pinned Checklists) but is missing HST Bar, Weather, Email, and Pinned All sections. It also lacks the layout configuration modal.

## Tasks

### 7.1 Add HST (Horizontal Strip Timeline) Section
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/omni/OmniViewScreen.kt`

The HST bar shows a horizontal scrollable timeline of upcoming events for the next few hours, with time markers and weather icons interspersed.

**Implementation:**
- Horizontal LazyRow showing the next 12-24 hours
- Each item: time label + event title (if any) + weather icon (if weather data available)
- Tap event → navigate to editor
- Mode toggle (from settings): "chits", "both" (chits + weather), "weather", "none"

**Data:** Filter chits with start_datetime in the next 24 hours, sorted chronologically. Weather data from cached weather API response.

**Web reference:** `src/frontend/js/dashboard/main-omni.js` (`_renderOmniHST`)

### 7.2 Add Weather Section
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/omni/OmniViewScreen.kt`

Shows current weather conditions and a brief forecast.

**Implementation:**
- Card showing: current temp, condition icon, high/low, location name
- Below: 3-5 hour forecast strip (small icons + temps)
- Tap → navigate to Weather screen

**Data:** From cached weather API response (same data the Weather screen uses)

**Web reference:** `src/frontend/js/dashboard/main-omni.js` (`_renderOmniWeather`)

### 7.3 Add Email Section
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/omni/OmniViewScreen.kt`

Shows recent unread emails with pagination.

**Implementation:**
- Shows up to N recent unread emails (N from settings, default 5)
- Each item: sender, subject, time
- "Show More" / "Show Less" pagination
- Tap email → navigate to editor with that chit
- Only visible when email feature is configured (has email accounts)

**Data:** Filter chits where email_message_id is not null, has "Inbox" tag, is unread, sorted by date desc.

**Web reference:** `src/frontend/js/dashboard/main-omni.js` (`_renderOmniEmail`)

### 7.4 Add Pinned All Section
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/omni/OmniViewScreen.kt`

Combined view of ALL pinned items (notes + checklists + any other pinned chits).

**Implementation:**
- Same as Pinned Notes + Pinned Checklists but merged into one list
- Sorted by modified date
- Each card shows type indicator (note icon, checklist icon, etc.)

**Data:** All chits where `pinned = true`

### 7.5 Add Layout Configuration
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/omni/OmniLayoutDialog.kt`

The web has a modal where users can drag-to-reorder sections, toggle visibility, and set column placement.

**Implementation:**
- Bottom sheet or full-screen dialog
- List of all sections with:
  - Drag handle for reorder
  - Visibility toggle (eye icon)
  - Width toggle (full / half) — on mobile this might just be "show/hide" since there's only one column
- Save button persists to settings

**Access:** Add a "Configure" button/icon in the Omni View top area (gear icon or overflow menu item)

**Data:** `omni_layout` field in settings (JSON array of section configs: {id, visible, position, width, column, hideWhenEmpty})

### 7.6 Update OmniSectionType Enum
**File:** `android/app/src/main/java/com/cwoc/app/ui/screens/omni/OmniViewViewModel.kt` (or wherever OmniSectionType is defined)

Add the missing section types:
```kotlin
enum class OmniSectionType {
    HST,
    WEATHER,
    HST_WEATHER,
    HST_TEMP_STRIP,
    CHRONO_ANCHORED,
    REMINDERS,
    ON_DECK,
    SOON,
    EMAIL,
    PINNED_NOTES,
    PINNED_CHECKLISTS,
    PINNED_ALL
}
```

### 7.7 HST Mode Toggle
The HST bar has its own mode: chits | both | weather | none. This should be configurable from the layout dialog or from a long-press on the HST section header.

## Web Reference Files
- `src/frontend/js/dashboard/main-omni.js` — Full Omni View implementation
- `src/frontend/html/index.html` — Omni layout modal template

## Verification
- [ ] HST bar shows horizontal timeline of upcoming events
- [ ] Weather section shows current conditions + brief forecast
- [ ] Email section shows recent unread emails (when email is configured)
- [ ] Pinned All section shows all pinned items combined
- [ ] Layout configuration dialog allows reorder, show/hide sections
- [ ] Section visibility persists across app restarts
- [ ] Empty sections show "Nothing here" or are hidden (based on hideWhenEmpty setting)
- [ ] All sections are tappable (navigate to relevant screen or editor)
