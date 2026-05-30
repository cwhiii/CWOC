# GPS Location Notifications Spec

**Platform:** App only (Android) — geofencing requires native OS APIs unavailable on web

**Created:** 2026-05-30

**Description:** Allow chits to trigger notifications when the user enters or exits a defined radius around a saved location (e.g., "notify me when within 1 mile of Home").

---

## Requirements

### 1. Location-Based Notification Trigger
- Each chit can have an optional **location notification radius** (in miles or km)
- When the user enters the defined radius of a chit's location, a notification fires
- When the user exits the radius, optionally fire a "leaving area" notification
- Default radius: 1 mile (configurable in Settings)

### 2. Location Source
- Uses the chit's existing **location** field (address string)
- On save, geocode the address to lat/lon coordinates
- Store geocoded coordinates for geofence registration
- Handle geocoding failures gracefully (notify user, don't save)

### 3. Notification Behavior
- Foreground notification while geofence transition is processing
- Notification opens the chit in the editor when tapped
- Debounce duplicate notifications (same chit, same transition within 5 minutes)
- Respect chit's existing **alarm_orientation** setting for notification timing

### 4. Settings Integration
- Global default radius in Settings → Notifications
- Per-chit override option in the editor
- Enable/disable location notifications globally

### 5. Background Behavior
- Geofences persist across app restarts
- Use **GeofencingClient** with **BroadcastReceiver** for transitions
- **WorkManager** for periodic location sanity checks
- Battery-efficient — no continuous GPS, only geofence transitions

---

## Design

### Database Schema Changes

**Chit entity (Android Room):**
```kotlin
data class ChitEntity(
    // ... existing fields ...
    val location: String? = null,                    // Address string (existing)
    val location_lat: Double? = null,                // Geocoded latitude (NEW)
    val location_lon: Double? = null,                // Geocoded longitude (NEW)
    val location_radius_miles: Double? = null,       // Notification radius (NEW)
    val location_notifications_enabled: Int = 0,     // 1 = enabled, 0 = disabled (NEW)
)
```

**Settings entity:**
```kotlin
data class SettingsEntity(
    // ... existing fields ...
    val default_location_radius_miles: Double = 1.0, // NEW
    val location_notifications_enabled: Int = 1,     // NEW
)
```

### Backend Changes

**Python models.py:**
```python
class Chit(BaseModel):
    # ... existing fields ...
    location_radius_miles: Optional[float] = None
    location_notifications_enabled: Optional[int] = 0
```

**Database migrations:**
- Add `location_radius_miles` and `location_notifications_enabled` columns to `chits` table
- Add `default_location_radius_miles` column to `settings` table

### Android Architecture

**Geofence Manager (new):**
```
com.cwoc.app.data.local.geofence/
├── GeofenceManager.kt          // Register, unregister, handle transitions
└── GeofenceBroadcastReceiver.kt // Receives GeofenceTransitions
```

**Editor Changes:**
```
com.cwoc.app.ui.screens.editor/
├── EditorLocationZone.kt       // Add radius input, enable toggle
└── LocationGeocoder.kt         // Geocode address to lat/lon
```

**Notification Handler:**
```
com.cwoc.app.widget.notifications/
└── LocationNotificationHelper.kt // Build and show location notifications
```

### UI Flow

1. **Editor → Location Zone:**
   - Existing address field
   - NEW: "Notify when near" toggle (on/off)
   - NEW: Radius slider/input (0.1 to 10 miles, default 1)
   - NEW: "Arriving" / "Leaving" toggle (default: Arriving only)

2. **Settings → Notifications:**
   - "Location Notifications" master toggle
   - "Default Radius" slider/input
   - "Show on Map" button to preview geofence circle

3. **Notification Display:**
   - System notification tray when geofence crossed
   - Opens chit editor on tap
   - Dismisses when chit is opened or notification is cleared

---

## Implementation Tasks

### Phase 1: Database & Backend
- [ ] Add `location_radius_miles` and `location_notifications_enabled` columns to chits table (Python migration)
- [ ] Add `default_location_radius_miles` and `location_notifications_enabled` columns to settings table (Python migration)
- [ ] Update Pydantic models in `src/backend/models.py`
- [ ] Update Android Room entities (ChitEntity, SettingsEntity)
- [ ] Create Room migration for Android (Migration 15_16)
- [ ] Update DAOs to include new fields
- [ ] Update API sync to send/receive new fields

### Phase 2: Editor UI
- [ ] Add radius input and enable toggle to EditorLocationZone (Android)
- [ ] Add geocoding on location save (call Nominatim API)
- [ ] Store geocoded lat/lon in entity
- [ ] Validate radius is positive number
- [ ] Persist settings to backend on change

### Phase 3: Geofencing Infrastructure
- [ ] Create GeofenceManager with GeofencingClient
- [ ] Implement registerGeofence(chit) method
- [ ] Implement unregisterGeofence(chitId) method
- [ ] Create GeofenceBroadcastReceiver for transitions
- [ ] Handle GeofenceTransitions: ENTER and EXIT
- [ ] Add WorkManager for periodic geofence re-registration (battery backup)

### Phase 4: Notifications
- [ ] Create LocationNotificationHelper
- [ ] Build notification with chit title and "Near [Location]"
- [ ] Set notification intent to open chit editor
- [ ] Add notification channel for location alerts
- [ ] Implement debouncing (5-min window per chit)
- [ ] Handle notification tap → open editor

### Phase 5: Settings Integration
- [ ] Add global toggle in Settings → Notifications
- [ ] Add default radius slider in Settings
- [ ] Add "Test Notification" button
- [ ] Add "Preview on Map" to show geofence circle

### Phase 6: Sync & Edge Cases
- [ ] Sync geofences when chits are created/updated/deleted
- [ ] Handle geocoding failures (show error, don't save)
- [ ] Handle location field cleared (unregister geofence)
- [ ] Handle radius changed (re-register geofence)
- [ ] Handle chit deleted (unregister geofence)
- [ ] Handle app update (re-register all active geofences)

### Phase 7: Testing
- [ ] Test geofence registration with valid lat/lon
- [ ] Test geofence transition notification
- [ ] Test debouncing behavior
- [ ] Test radius slider accuracy
- [ ] Test geocoding with various address formats
- [ ] Test notification tap opens correct chit
- [ ] Test settings persistence
- [ ] Test battery impact (background usage)

---

## Dependencies

- **AndroidX WorkManager** — for background geofence re-registration
- **Google Play Services Location** — GeofencingClient API
- **Nominatim (OpenStreetMap)** — existing geocoder, no new dependency

---

## Files to Create/Modify

### New Files (Android)
- `android/app/src/main/java/com/cwoc/app/data/local/geofence/GeofenceManager.kt`
- `android/app/src/main/java/com/cwoc/app/data/local/geofence/GeofenceBroadcastReceiver.kt`
- `android/app/src/main/java/com/cwoc/app/widget/notifications/LocationNotificationHelper.kt`
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/LocationGeocoder.kt`

### Modified Files (Android)
- `android/app/src/main/java/com/cwoc/app/data/local/entity/ChitEntity.kt` — add fields
- `android/app/src/main/java/com/cwoc/app/data/local/entity/SettingsEntity.kt` — add fields
- `android/app/src/main/java/com/cwoc/app/data/local/dao/ChitDao.kt` — update queries
- `android/app/src/main/java/com/cwoc/app/data/local/dao/SettingsDao.kt` — update queries
- `android/app/src/main/java/com/cwoc/app/data/local/migration/Migration_15_16.kt` — new migration
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/EditorLocationZone.kt` — add UI
- `android/app/src/main/java/com/cwoc/app/ui/screens/settings/NotificationsSettingsTab.kt` — add settings
- `android/app/src/main/java/com/cwoc/app/sync/SyncEngine.kt` — sync new fields
- `android/app/src/main/AndroidManifest.xml` — add permissions and receiver

### Modified Files (Backend)
- `src/backend/models.py` — add fields to Chit model
- `src/backend/migrations.py` — add migration functions
- `src/backend/routes/chits.py` — handle new fields in CRUD
- `src/backend/routes/settings.py` — handle new settings fields

### Modified Files (Frontend)
- `src/frontend/js/editor/editor-location.js` — add radius UI (web parity)
- `src/frontend/html/settings.html` — add location notification settings (web parity)
- `src/frontend/js/pages/settings.js` — handle new settings (web parity)

---

## Notes

- **Web parity not applicable** — geofencing requires native Android APIs
- **Battery impact** — geofencing is designed for low power (uses cell tower/WiFi, not continuous GPS)
- **Permission required** — ACCESS_FINE_LOCATION for geofencing
- **Google Play Services** — required for GeofencingClient (assume installed on target devices)