# Design Document: Android Contacts Rolodex

## Overview

This design rebuilds the Android Contacts Rolodex to achieve full parity with the web version. The existing codebase already has: ContactEntity (Room, all fields), ContactDao (basic CRUD), ContactRepository (with dirty tracking + push sync), ContactListViewModel, ContactEditorViewModel, ContactListScreen, ContactEditorScreen, ContactTrashScreen, and navigation routes. The current implementation is broken — showing raw JSON, colors instead of data, no images, missing toolbar actions, and incomplete editor zones. This design specifies the complete rewrite of the UI layer and enhancements to the data/API layers needed for full feature parity.

## Components and Interfaces

This design rebuilds the Android Contacts Rolodex to achieve full parity with the web version. The existing codebase already has: ContactEntity (Room, all fields), ContactDao (basic CRUD), ContactRepository (with dirty tracking + push sync), ContactListViewModel, ContactEditorViewModel, ContactListScreen, ContactEditorScreen, ContactTrashScreen, and navigation routes. The current implementation is broken — showing raw JSON, colors instead of data, no images, missing toolbar actions, and incomplete editor zones. This design specifies the complete rewrite of the UI layer and enhancements to the data/API layers needed for full feature parity.

## Architecture

The feature follows the existing app architecture:
- **UI Layer**: Jetpack Compose screens + ViewModels (Hilt-injected)
- **Data Layer**: Room (ContactEntity + ContactDao) + Retrofit (CwocApiService) + ContactRepository
- **DI**: Hilt modules (AppModule for DB/DAOs, NetworkModule for API, SyncModule for repository bindings)
- **Sync**: SyncEngine (pull) + SyncPushEngine (push) + DirtyTracker (field-level dirty state)

## Components

### 1. Data Layer Enhancements

#### 1.1 ContactDao Additions

New queries needed beyond what exists:

```kotlin
// Trash view: soft-deleted contacts
@Query("SELECT * FROM contacts WHERE deleted = 1 ORDER BY deletedDatetime DESC")
fun getDeletedContacts(): Flow<List<ContactEntity>>

// Grouped mode queries
@Query("SELECT * FROM contacts WHERE deleted = 0 AND favorite = 1 ORDER BY displayName COLLATE NOCASE ASC")
fun getFavorites(): Flow<List<ContactEntity>>

@Query("SELECT * FROM contacts WHERE deleted = 0 AND favorite = 0 AND sharedToVault = 0 ORDER BY displayName COLLATE NOCASE ASC")
fun getNonFavoriteOwned(): Flow<List<ContactEntity>>

@Query("SELECT * FROM contacts WHERE deleted = 0 AND sharedToVault = 1 AND ownerId != :currentUserId ORDER BY displayName COLLATE NOCASE ASC")
fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>>

// Full-text search across ALL fields (matching web behavior)
@Query("""SELECT * FROM contacts WHERE deleted = 0 AND (
    displayName LIKE '%' || :q || '%' OR givenName LIKE '%' || :q || '%' OR 
    surname LIKE '%' || :q || '%' OR nickname LIKE '%' || :q || '%' OR 
    organization LIKE '%' || :q || '%' OR socialContext LIKE '%' || :q || '%' OR 
    emails LIKE '%' || :q || '%' OR phones LIKE '%' || :q || '%' OR 
    addresses LIKE '%' || :q || '%' OR callSigns LIKE '%' || :q || '%' OR 
    xHandles LIKE '%' || :q || '%' OR websites LIKE '%' || :q || '%' OR 
    dates LIKE '%' || :q || '%' OR notes LIKE '%' || :q || '%' OR 
    tags LIKE '%' || :q || '%')
    ORDER BY favorite DESC, displayName COLLATE NOCASE ASC""")
fun searchAll(q: String): Flow<List<ContactEntity>>

// Restore from trash
@Query("UPDATE contacts SET deleted = 0, deletedDatetime = null, isDirty = 1 WHERE id = :id")
suspend fun restoreFromTrash(id: String)

// Permanent purge
@Query("DELETE FROM contacts WHERE id = :id")
suspend fun purge(id: String)

// Toggle favorite
@Query("UPDATE contacts SET favorite = NOT favorite, modifiedDatetime = :now, isDirty = 1 WHERE id = :id")
suspend fun toggleFavorite(id: String, now: String)
```

#### 1.2 CwocApiService Additions

New endpoints needed (added to existing interface):

```kotlin
// Contact-specific endpoints (not covered by sync push)
@PATCH("/api/contacts/{id}/favorite")
suspend fun toggleContactFavorite(@Path("id") id: String): Response<Map<String, Any>>

@Multipart
@POST("/api/contacts/{id}/image")
suspend fun uploadContactImage(
    @Path("id") id: String,
    @Part file: MultipartBody.Part
): Response<Map<String, String>>

@DELETE("/api/contacts/{id}/image")
suspend fun deleteContactImage(@Path("id") id: String): Response<Unit>

@Multipart
@POST("/api/contacts/import")
suspend fun importContacts(@Part file: MultipartBody.Part): Response<ImportResultDto>

@GET("/api/contacts/export")
@Streaming
suspend fun exportContacts(@Query("format") format: String): Response<ResponseBody>

@GET("/api/contacts/{id}/export")
@Streaming
suspend fun exportSingleContact(
    @Path("id") id: String,
    @Query("format") format: String
): Response<ResponseBody>

@GET("/api/trash/contacts")
suspend fun getTrashContacts(): Response<List<Map<String, Any?>>>

@POST("/api/trash/contacts/{id}/restore")
suspend fun restoreContact(@Path("id") id: String): Response<Unit>

@DELETE("/api/trash/contacts/{id}/purge")
suspend fun purgeContact(@Path("id") id: String): Response<Unit>

@GET("/api/auth/switchable-users")
suspend fun getSwitchableUsers(): Response<List<SwitchableUserDto>>

@GET("/api/contacts/birthdays")
suspend fun getContactBirthdays(): Response<List<Map<String, Any?>>>
```

#### 1.3 DTOs

```kotlin
data class ImportResultDto(
    val imported: Int,
    val skipped: Int,
    val errors: List<ImportErrorDto>
)

data class ImportErrorDto(
    val entry: Int?,
    val reason: String
)

data class SwitchableUserDto(
    val id: String,
    val username: String,
    @SerializedName("display_name") val displayName: String?,
    val email: String?,
    @SerializedName("profile_image_url") val profileImageUrl: String?
)
```

#### 1.4 ContactRepository Enhancements

Add to the existing interface:

```kotlin
interface ContactRepository {
    // ... existing methods ...
    
    suspend fun toggleFavorite(contactId: String)
    suspend fun uploadImage(contactId: String, imageFile: File): String?
    suspend fun deleteImage(contactId: String)
    suspend fun importFile(uri: Uri): ImportResultDto
    suspend fun exportAll(format: String): File?
    suspend fun exportSingle(contactId: String): File?
    fun getTrashContacts(): Flow<List<ContactEntity>>
    suspend fun restoreFromTrash(contactId: String)
    suspend fun purgeFromTrash(contactId: String)
    suspend fun getSwitchableUsers(): List<SwitchableUserDto>
}
```

### 2. UI Layer — People Page

#### 2.1 PeopleScreen Composable Structure

```
PeopleScreen
├── PeopleToolbar
│   ├── NewContactButton
│   ├── ImportButton
│   ├── ExportButton (with dropdown)
│   ├── GroupToggleButton
│   ├── TrashButton
│   └── SearchField
├── ContactList (LazyColumn)
│   ├── [Grouped Mode]
│   │   ├── SectionHeader("★ Favorites") + content
│   │   ├── SectionHeader("Users") + content
│   │   ├── SectionHeader("All Contacts") + content
│   │   └── SectionHeader("🏛️ Contact Vault") + content
│   └── [Ungrouped Mode]
│       └── Flat alphabetical list
├── ImportResultDialog
└── EmptyState
```

#### 2.2 ContactRow Composable

```
ContactRow
├── StarToggle (★/☆)
├── ContactThumbnail (32dp circle, image or placeholder)
├── InfoColumn
│   ├── DisplayName (bold if favorite)
│   └── DetailLine (email · phone · org)
├── VaultIcon (🏛️, conditional)
└── QRShareButton
```

Color theming: When `contact.color != null`, compute background tint and auto-contrast text color using luminance calculation.

#### 2.3 PeopleViewModel State

```kotlin
data class PeopleUiState(
    val isGrouped: Boolean = true,
    val searchQuery: String = "",
    val favorites: List<ContactEntity> = emptyList(),
    val users: List<SwitchableUserDto> = emptyList(),
    val allContacts: List<ContactEntity> = emptyList(),
    val vaultContacts: List<ContactEntity> = emptyList(),
    val flatList: List<Any> = emptyList(), // ContactEntity or SwitchableUserDto
    val collapsedSections: Set<String> = emptySet(),
    val isImporting: Boolean = false,
    val importResult: ImportResultDto? = null,
    val errorMessage: String? = null
)
```

### 3. UI Layer — Contact Editor

#### 3.1 ContactEditorScreen Composable Structure

```
ContactEditorScreen
├── EditorTopBar
│   ├── FavoriteToggle (★/☆)
│   ├── SaveStayButton (visible when dirty)
│   ├── SaveExitButton (visible when dirty)
│   ├── ExitButton
│   ├── QRButton (hidden for new)
│   ├── AuditButton (hidden for new)
│   └── DeleteButton (hidden for new)
├── ProfileImageArea
│   ├── CircularImage/Placeholder (80dp)
│   ├── CameraButton
│   ├── ViewButton (conditional)
│   ├── RemoveButton (conditional)
│   ├── DisplayNameHeader (live-updating)
│   └── VaultTogglePill
├── ScrollableContent
│   ├── NameZone (collapsible)
│   │   ├── PrefixDropdown (with custom option)
│   │   ├── GivenNameField (required)
│   │   ├── MiddleNamesField
│   │   ├── SurnameField
│   │   ├── SuffixDropdown (with custom option)
│   │   └── NicknameField
│   ├── PhoneEmailZone (collapsible)
│   │   ├── PhoneSection (multi-value rows + Add button)
│   │   ├── EmailSection (multi-value rows + Add button)
│   │   ├── AddressSection (multi-value rows + map/context buttons + Add button)
│   │   └── DatesSection (multi-value rows + date picker + calendar toggle + Add button)
│   ├── SocialWebZone (collapsible)
│   │   ├── XHandleSection (multi-value rows + Add button)
│   │   ├── WebsiteSection (multi-value rows + link icon + Add button)
│   │   └── CallSignSection (multi-value rows + Add button)
│   ├── SecurityZone (collapsible)
│   │   ├── SignalToggle + UsernameField + MessageButton
│   │   └── PGPKeyField + ValidateButton
│   ├── ContextZone (collapsible)
│   │   ├── OrganizationField
│   │   └── SocialContextField
│   ├── ColorZone (collapsible)
│   │   ├── HexInput + PreviewCircle
│   │   └── ColorSwatchGrid (20 colors + clear)
│   ├── NotesZone (collapsible, default collapsed)
│   │   └── NotesTextArea
│   └── TagsZone (collapsible, default collapsed)
│       ├── TagInput
│       └── TagChipFlow
├── UnsavedChangesDialog
├── DeleteConfirmDialog
├── QRCodeDialog
└── FullSizeImageDialog
```

#### 3.2 Multi-Value Field Component

Reusable composable for phones, emails, addresses, etc.:

```kotlin
@Composable
fun MultiValueSection(
    title: String,
    icon: ImageVector,
    entries: List<MultiValueEntry>,
    defaultLabel: String,
    valuePlaceholder: String,
    onAdd: () -> Unit,
    onRemove: (Int) -> Unit,
    onLabelChange: (Int, String) -> Unit,
    onValueChange: (Int, String) -> Unit,
    extraActions: @Composable ((Int, MultiValueEntry) -> Unit)? = null
)

data class MultiValueEntry(
    val label: String = "",
    val value: String = "",
    val showOnCalendar: Boolean? = null // Only for dates
)
```

#### 3.3 ContactEditorViewModel State

```kotlin
data class ContactEditorUiState(
    val mode: EditorMode = EditorMode.Create,
    val isDirty: Boolean = false,
    val isSaving: Boolean = false,
    val formState: ContactFormState = ContactFormState(id = ""),
    val pendingImageUri: Uri? = null,
    val pendingImageRemove: Boolean = false,
    val expandedZones: Set<String> = setOf("name", "phoneEmail", "socialWeb", "security", "context", "color"),
    val errorMessage: String? = null,
    val saveSuccess: Boolean = false,
    val navigateBack: Boolean = false
)

enum class EditorMode { Create, Edit, Profile, ProfileReadOnly }
```

#### 3.4 Dirty Tracking

The existing `detectContactChangedFields()` in ContactMapper handles field-level dirty detection. The ViewModel compares current form state against the loaded original entity on every change to determine `isDirty`.

### 4. UI Layer — Contact Trash

#### 4.1 ContactTrashScreen Structure

```
ContactTrashScreen
├── TrashToolbar
│   ├── CountLabel
│   ├── SelectAllCheckbox
│   ├── BulkRestoreButton (visible when selected > 0)
│   └── BulkDeleteButton (visible when selected > 0)
├── TrashList (LazyColumn)
│   └── TrashRow
│       ├── Checkbox
│       ├── Name + VaultBadge
│       ├── Organization
│       ├── Email
│       ├── Phone
│       ├── DeletedTimestamp
│       └── ActionButtons (Restore, Delete)
├── EmptyState ("No deleted contacts.")
└── PurgeConfirmDialog
```

### 5. QR Code Generation

#### 5.1 VCardBuilder

Kotlin object that constructs vCard 3.0 strings:

```kotlin
object VCardBuilder {
    fun build(contact: ContactEntity): String {
        // Generates: BEGIN:VCARD, VERSION:3.0, N, FN, TEL, EMAIL, ADR, URL,
        // X-SIGNAL, X-PGP-KEY, X-CALLSIGN, X-XHANDLE, X-FAVORITE,
        // ORG, NICKNAME, NOTE, BDAY, END:VCARD
    }
    
    fun byteSize(vcard: String): Int = vcard.toByteArray(Charsets.UTF_8).size
    
    const val MAX_QR_BYTES = 2953
}
```

#### 5.2 QR Dialog

Uses `com.google.zxing:core` library (already available or add as dependency) to generate QR bitmap from vCard string. Displays in a Material3 AlertDialog with title, QR image, info text, and close button.

### 6. Image Management

#### 6.1 ImageManager

Handles gallery selection, camera capture, and resize:

```kotlin
class ContactImageManager(private val context: Context) {
    suspend fun resizeImage(uri: Uri, maxSize: Int = 512): File
    fun isGif(uri: Uri): Boolean
    fun createTempFile(): File
}
```

- Gallery: `ActivityResultContracts.GetContent()` with `image/*`
- Camera: `ActivityResultContracts.TakePicture()` with FileProvider URI
- Resize: Load bitmap, scale to max 512px, compress to JPEG 85% quality
- GIFs: Copy as-is without processing

### 7. Auto-Contrast Algorithm

```kotlin
fun computeAutoContrast(backgroundColor: Color): Color {
    val luminance = (0.299 * backgroundColor.red + 
                     0.587 * backgroundColor.green + 
                     0.114 * backgroundColor.blue)
    return if (luminance > 0.5) Color(0xFF1A1208) else Color(0xFFFFFAF0)
}
```

### 8. DataStore Preferences

For persisting UI state locally:

```kotlin
object ContactPrefsKeys {
    val IS_GROUPED = booleanPreferencesKey("contacts_is_grouped")
    val COLLAPSED_SECTIONS = stringSetPreferencesKey("contacts_collapsed_sections")
    fun userFavoriteKey(userId: String) = booleanPreferencesKey("user_fav_$userId")
}
```

Note: The existing code uses SharedPreferences. We'll continue using SharedPreferences for consistency with the existing `ContactListViewModel` pattern rather than migrating to DataStore.

### 9. Navigation

Existing routes are already defined in `Screen.kt`:
- `Screen.Contacts` → People Page
- `Screen.ContactEditor` → Editor (with contactId + optional userId)
- `Screen.ContactTrash` → Trash Page

The NavGraph already has composable entries for these. The design reuses these routes, just rebuilds the screen implementations.

## Data Models

### ContactEntity (existing, enhanced)
Room entity with all fields: id, givenName, surname, middleNames, prefix, suffix, nickname, displayName, phones (JSON), emails (JSON), addresses (JSON), callSigns (JSON), xHandles (JSON), websites (JSON), dates (JSON), hasSignal, signalUsername, pgpKey, favorite, color, organization, socialContext, imageUrl, notes, tags (List<String>), sharedToVault, createdDatetime, modifiedDatetime, syncVersion, lastSyncedAt, ownerId, deletedDatetime, isDirty, dirtyFields, deleted, hasUnviewedConflict, conflictFields.

### MultiValueEntry
```kotlin
data class MultiValueEntry(
    val label: String = "",
    val value: String = "",
    val showOnCalendar: Boolean? = null
)
```

### PeopleUiState
```kotlin
data class PeopleUiState(
    val isGrouped: Boolean = true,
    val searchQuery: String = "",
    val favorites: List<ContactEntity> = emptyList(),
    val users: List<SwitchableUserDto> = emptyList(),
    val allContacts: List<ContactEntity> = emptyList(),
    val vaultContacts: List<ContactEntity> = emptyList(),
    val flatList: List<Any> = emptyList(),
    val collapsedSections: Set<String> = emptySet(),
    val isImporting: Boolean = false,
    val importResult: ImportResultDto? = null,
    val errorMessage: String? = null
)
```

### ContactEditorUiState
```kotlin
data class ContactEditorUiState(
    val mode: EditorMode = EditorMode.Create,
    val isDirty: Boolean = false,
    val isSaving: Boolean = false,
    val formState: ContactFormState = ContactFormState(id = ""),
    val pendingImageUri: Uri? = null,
    val pendingImageRemove: Boolean = false,
    val expandedZones: Set<String> = setOf("name", "phoneEmail", "socialWeb", "security", "context", "color"),
    val errorMessage: String? = null,
    val saveSuccess: Boolean = false,
    val navigateBack: Boolean = false
)
```

### ImportResultDto
```kotlin
data class ImportResultDto(val imported: Int, val skipped: Int, val errors: List<ImportErrorDto>)
data class ImportErrorDto(val entry: Int?, val reason: String)
```

### SwitchableUserDto
```kotlin
data class SwitchableUserDto(
    val id: String,
    val username: String,
    @SerializedName("display_name") val displayName: String?,
    val email: String?,
    @SerializedName("profile_image_url") val profileImageUrl: String?
)
```

## Data Flow

### Contact List Load
1. PeopleViewModel observes `contactDao.getAllActive()` (or grouped queries)
2. On search: client-side filter + 300ms debounced API call via repository
3. Grouped mode: separate queries for favorites, owned, vault + API call for users
4. Section collapse state read from SharedPreferences

### Contact Save
1. User edits fields → ViewModel updates form state → isDirty = true
2. User taps Save → ViewModel calls `contactRepository.create()` or `.update()`
3. Repository: upserts to Room, marks dirty via DirtyTracker, triggers push if online
4. SyncPushEngine batches dirty contacts into `POST /api/sync/push`
5. On success: clears dirty state, updates syncVersion

### Image Upload
1. User selects/captures image → staged as local URI in ViewModel
2. On save: after contact is persisted, upload image via `POST /api/contacts/{id}/image`
3. Update imageUrl in local entity with returned URL

### Import Flow
1. User picks file → ViewModel reads URI content
2. Upload to `POST /api/contacts/import` as multipart
3. Display result dialog
4. Trigger sync to pull newly imported contacts into local DB

### Export Flow
1. User selects format → ViewModel calls export API
2. Save response body to Downloads folder
3. Show success toast or share intent

## Error Handling

- API failures: Show snackbar with error message, revert optimistic UI updates
- Offline: Display cached contacts from Room, disable save/import/export with message
- Image upload failure: Show error toast, contact saves without image
- Import failure: Show error in result dialog with per-entry error details
