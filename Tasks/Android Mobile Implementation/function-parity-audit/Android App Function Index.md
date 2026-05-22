# CWOC Android App — Complete Function Index

> Every function in the Android app source code.
> Total: 1982 functions across 269 files.

---

## (root)/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1 | CwocApplication.kt | `onCreate` | override fun onCreate() |
| 2 | MainActivity.kt | `CwocApp` | private fun CwocApp( |
| 3 | MainActivity.kt | `onCreate` | override fun onCreate(savedInstanceState: Bundle?) |

## data/attachment/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 4 | AttachmentCache.kt | `evictIfNeeded` | suspend fun evictIfNeeded() |
| 5 | AttachmentCache.kt | `get` | suspend fun get(attachmentId: String): File? |
| 6 | AttachmentCache.kt | `getTotalSize` | suspend fun getTotalSize(): Long |
| 7 | AttachmentCache.kt | `put` | suspend fun put(attachmentId: String, data: ByteArray) |
| 8 | AttachmentCache.kt | `remove` | suspend fun remove(attachmentId: String) |
| 9 | AttachmentManager.kt | `downloadAttachment` | suspend fun downloadAttachment(attachmentId: String, url: String): Result<File> |
| 10 | AttachmentManager.kt | `getCachedFile` | suspend fun getCachedFile(attachmentId: String): File? |
| 11 | AttachmentManager.kt | `getDownloadState` | fun getDownloadState(attachmentId: String): StateFlow<DownloadState> |
| 12 | AttachmentManager.kt | `getOrCreateStateFlow` | private fun getOrCreateStateFlow(attachmentId: String): MutableStateFlow<DownloadState> |
| 13 | AttachmentManager.kt | `uploadAttachment` | suspend fun uploadAttachment( |
| 14 | AttachmentManager.kt | `uploadPendingAttachments` | suspend fun uploadPendingAttachments() |

## data/local/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 15 | CwocDatabase.kt | `attachmentMetadataDao` | abstract fun attachmentMetadataDao(): AttachmentMetadataDao |
| 16 | CwocDatabase.kt | `chitDao` | abstract fun chitDao(): ChitDao |
| 17 | CwocDatabase.kt | `contactDao` | abstract fun contactDao(): ContactDao |
| 18 | CwocDatabase.kt | `notificationDao` | abstract fun notificationDao(): NotificationDao |
| 19 | CwocDatabase.kt | `settingsDao` | abstract fun settingsDao(): SettingsDao |
| 20 | CwocDatabase.kt | `standaloneAlertDao` | abstract fun standaloneAlertDao(): StandaloneAlertDao |
| 21 | CwocDatabase.kt | `syncMetadataDao` | abstract fun syncMetadataDao(): SyncMetadataDao |

## data/local/converter/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 22 | Converters.kt | `fromStringList` | fun fromStringList(value: List<String>?): String? |
| 23 | Converters.kt | `toStringList` | fun toStringList(value: String?): List<String>? |

## data/local/dao/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 24 | AttachmentMetadataDao.kt | `clearLocalPath` | suspend fun clearLocalPath(id: String) |
| 25 | AttachmentMetadataDao.kt | `getAllCachedSortedByAccess` | suspend fun getAllCachedSortedByAccess(): List<AttachmentMetadata> |
| 26 | AttachmentMetadataDao.kt | `getByChitId` | suspend fun getByChitId(chitId: String): List<AttachmentMetadata> |
| 27 | AttachmentMetadataDao.kt | `getById` | suspend fun getById(id: String): AttachmentMetadata? |
| 28 | AttachmentMetadataDao.kt | `getByUrl` | suspend fun getByUrl(url: String): AttachmentMetadata? |
| 29 | AttachmentMetadataDao.kt | `getPendingUploads` | suspend fun getPendingUploads(): List<AttachmentMetadata> |
| 30 | AttachmentMetadataDao.kt | `insert` | suspend fun insert(attachment: AttachmentMetadata) |
| 31 | AttachmentMetadataDao.kt | `updateAfterUpload` | suspend fun updateAfterUpload(id: String, url: String) |
| 32 | AttachmentMetadataDao.kt | `updateLastAccessed` | suspend fun updateLastAccessed(id: String, timestamp: String) |
| 33 | AttachmentMetadataDao.kt | `updateLocalPath` | suspend fun updateLocalPath(id: String, localPath: String?) |
| 34 | ChitDao.kt | `clearConflictFlag` | suspend fun clearConflictFlag(id: String) |
| 35 | ChitDao.kt | `getAlertChits` | fun getAlertChits(): Flow<List<ChitEntity>> |
| 36 | ChitDao.kt | `getAllNonDeleted` | fun getAllNonDeleted(): Flow<List<ChitEntity>> |
| 37 | ChitDao.kt | `getAllNonDeletedSnapshot` | suspend fun getAllNonDeletedSnapshot(): List<ChitEntity> |
| 38 | ChitDao.kt | `getById` | suspend fun getById(id: String): ChitEntity? |
| 39 | ChitDao.kt | `getCalendarChits` | fun getCalendarChits(): Flow<List<ChitEntity>> |
| 40 | ChitDao.kt | `getChecklistChits` | fun getChecklistChits(): Flow<List<ChitEntity>> |
| 41 | ChitDao.kt | `getChitsByIds` | suspend fun getChitsByIds(ids: List<String>): List<ChitEntity> |
| 42 | ChitDao.kt | `getChitsForDay` | fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> |
| 43 | ChitDao.kt | `getChitsForDaySuspend` | suspend fun getChitsForDaySuspend(dayStart: String, dayEnd: String): List<ChitEntity> |
| 44 | ChitDao.kt | `getChitsWithAlerts` | suspend fun getChitsWithAlerts(): List<ChitEntity> |
| 45 | ChitDao.kt | `getChitsWithTag` | suspend fun getChitsWithTag(tag: String): List<ChitEntity> |
| 46 | ChitDao.kt | `getCount` | suspend fun getCount(): Int |
| 47 | ChitDao.kt | `getDeletedChits` | fun getDeletedChits(): Flow<List<ChitEntity>> |
| 48 | ChitDao.kt | `getDirtyChits` | suspend fun getDirtyChits(): List<ChitEntity> |
| 49 | ChitDao.kt | `getDirtyCount` | suspend fun getDirtyCount(): Int |
| 50 | ChitDao.kt | `getFirstFive` | suspend fun getFirstFive(): List<ChitEntity> |
| 51 | ChitDao.kt | `getIndicatorChits` | fun getIndicatorChits(): Flow<List<ChitEntity>> |
| 52 | ChitDao.kt | `getLocationChits` | fun getLocationChits(): Flow<List<ChitEntity>> |
| 53 | ChitDao.kt | `getNoteChits` | fun getNoteChits(): Flow<List<ChitEntity>> |
| 54 | ChitDao.kt | `getProjectMasterChits` | fun getProjectMasterChits(): Flow<List<ChitEntity>> |
| 55 | ChitDao.kt | `getRecurringChits` | fun getRecurringChits(): Flow<List<ChitEntity>> |
| 56 | ChitDao.kt | `getTaskChits` | fun getTaskChits(): Flow<List<ChitEntity>> |
| 57 | ChitDao.kt | `getTasksByStatus` | fun getTasksByStatus(status: String): Flow<List<ChitEntity>> |
| 58 | ChitDao.kt | `getUpcomingTasksSuspend` | suspend fun getUpcomingTasksSuspend(): List<ChitEntity> |
| 59 | ChitDao.kt | `hardDelete` | suspend fun hardDelete(id: String) |
| 60 | ChitDao.kt | `markDeleted` | suspend fun markDeleted(id: String, now: String) |
| 61 | ChitDao.kt | `markDirty` | suspend fun markDirty(id: String, dirtyFields: String, now: String) |
| 62 | ChitDao.kt | `restoreDeleted` | suspend fun restoreDeleted(id: String, now: String) |
| 63 | ChitDao.kt | `setConflictState` | suspend fun setConflictState(id: String, fields: String) |
| 64 | ChitDao.kt | `updateDirtyState` | suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) |
| 65 | ChitDao.kt | `updateSyncVersion` | suspend fun updateSyncVersion(id: String, version: Int) |
| 66 | ChitDao.kt | `upsert` | suspend fun upsert(chit: ChitEntity) |
| 67 | ChitDao.kt | `upsertAll` | suspend fun upsertAll(chits: List<ChitEntity>) |
| 68 | ChitDao.kt | `upsertWithoutDirty` | suspend fun upsertWithoutDirty(chit: ChitEntity) |
| 69 | ContactDao.kt | `getAllActive` | fun getAllActive(): Flow<List<ContactEntity>> |
| 70 | ContactDao.kt | `getAllContacts` | fun getAllContacts(): Flow<List<ContactEntity>> |
| 71 | ContactDao.kt | `getById` | suspend fun getById(id: String): ContactEntity? |
| 72 | ContactDao.kt | `getDeletedContacts` | fun getDeletedContacts(): Flow<List<ContactEntity>> |
| 73 | ContactDao.kt | `getDirtyContacts` | suspend fun getDirtyContacts(): List<ContactEntity> |
| 74 | ContactDao.kt | `getFavoriteState` | suspend fun getFavoriteState(id: String): Boolean? |
| 75 | ContactDao.kt | `getFavorites` | fun getFavorites(): Flow<List<ContactEntity>> |
| 76 | ContactDao.kt | `getNonFavoriteOwned` | fun getNonFavoriteOwned(): Flow<List<ContactEntity>> |
| 77 | ContactDao.kt | `getVaultContacts` | fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>> |
| 78 | ContactDao.kt | `markDeleted` | suspend fun markDeleted(id: String, now: String) |
| 79 | ContactDao.kt | `purge` | suspend fun purge(id: String) |
| 80 | ContactDao.kt | `restoreFromTrash` | suspend fun restoreFromTrash(id: String, now: String) |
| 81 | ContactDao.kt | `search` | fun search(query: String): Flow<List<ContactEntity>> |
| 82 | ContactDao.kt | `searchAll` | fun searchAll(query: String): Flow<List<ContactEntity>> |
| 83 | ContactDao.kt | `setConflictState` | suspend fun setConflictState(id: String, fields: String) |
| 84 | ContactDao.kt | `toggleFavorite` | suspend fun toggleFavorite(id: String, now: String) |
| 85 | ContactDao.kt | `updateDirtyState` | suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) |
| 86 | ContactDao.kt | `updateSyncVersion` | suspend fun updateSyncVersion(id: String, version: Int) |
| 87 | ContactDao.kt | `upsert` | suspend fun upsert(contact: ContactEntity) |
| 88 | ContactDao.kt | `upsertAll` | suspend fun upsertAll(contacts: List<ContactEntity>) |
| 89 | NotificationDao.kt | `deleteAll` | suspend fun deleteAll() |
| 90 | NotificationDao.kt | `dismiss` | suspend fun dismiss(id: String) |
| 91 | NotificationDao.kt | `getAll` | fun getAll(): Flow<List<NotificationEntity>> |
| 92 | NotificationDao.kt | `getUnreadCount` | fun getUnreadCount(): Flow<Int> |
| 93 | NotificationDao.kt | `insert` | suspend fun insert(notification: NotificationEntity) |
| 94 | NotificationDao.kt | `insertAll` | suspend fun insertAll(notifications: List<NotificationEntity>) |
| 95 | NotificationDao.kt | `markRead` | suspend fun markRead(id: String) |
| 96 | NotificationDao.kt | `updateAction` | suspend fun updateAction(id: String, action: String) |
| 97 | SettingsDao.kt | `clearDirty` | suspend fun clearDirty() |
| 98 | SettingsDao.kt | `get` | suspend fun get(): SettingsEntity? |
| 99 | SettingsDao.kt | `getSettings` | fun getSettings(): Flow<SettingsEntity?> |
| 100 | SettingsDao.kt | `getSettingsOnce` | suspend fun getSettingsOnce(): SettingsEntity? |
| 101 | SettingsDao.kt | `markDirty` | suspend fun markDirty() |
| 102 | SettingsDao.kt | `replace` | suspend fun replace(settings: SettingsEntity) |
| 103 | SettingsDao.kt | `update` | suspend fun update(settings: SettingsEntity) |
| 104 | SettingsDao.kt | `updateSyncVersion` | suspend fun updateSyncVersion(version: Int) |
| 105 | SettingsDao.kt | `upsert` | suspend fun upsert(settings: SettingsEntity) |
| 106 | StandaloneAlertDao.kt | `deleteAll` | suspend fun deleteAll() |
| 107 | StandaloneAlertDao.kt | `deleteById` | suspend fun deleteById(id: String) |
| 108 | StandaloneAlertDao.kt | `getAll` | fun getAll(): Flow<List<StandaloneAlertEntity>> |
| 109 | StandaloneAlertDao.kt | `getByType` | fun getByType(type: String): Flow<List<StandaloneAlertEntity>> |
| 110 | StandaloneAlertDao.kt | `insert` | suspend fun insert(entity: StandaloneAlertEntity) |
| 111 | StandaloneAlertDao.kt | `insertAll` | suspend fun insertAll(entities: List<StandaloneAlertEntity>) |
| 112 | StandaloneAlertDao.kt | `update` | suspend fun update(entity: StandaloneAlertEntity) |
| 113 | SyncMetadataDao.kt | `getMetadata` | suspend fun getMetadata(): SyncMetadataEntity? |
| 114 | SyncMetadataDao.kt | `updateHighWaterMark` | suspend fun updateHighWaterMark(version: Int, timestamp: String) |
| 115 | SyncMetadataDao.kt | `updateSyncStatus` | suspend fun updateSyncStatus(status: String) |
| 116 | SyncMetadataDao.kt | `upsert` | suspend fun upsert(metadata: SyncMetadataEntity) |

## data/local/migration/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 117 | Migration1To2.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 118 | Migration2To3.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 119 | Migration3To4.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 120 | Migration4To5.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 121 | Migration5To6.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 122 | Migration6To7.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 123 | Migration7To8.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| 124 | Migration8To9.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |

## data/mapper/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 125 | ChitMapper.kt | `ChitEntity` | fun ChitEntity.toFormState(): ChitFormState |
| 126 | ChitMapper.kt | `ChitFormState` | fun ChitFormState.toEntity( |
| 127 | ChitMapper.kt | `detectChangedFields` | fun detectChangedFields(original: ChitEntity?, form: ChitFormState): Set<String> |
| 128 | ContactImageManager.kt | `createTempCameraFile` | fun createTempCameraFile(context: Context): Pair<File, Uri>? |
| 129 | ContactImageManager.kt | `fileToBytes` | fun fileToBytes(file: File): ByteArray = file.readBytes() |
| 130 | ContactImageManager.kt | `getMimeType` | fun getMimeType(file: File): String |
| 131 | ContactImageManager.kt | `isGif` | fun isGif(context: Context, uri: Uri): Boolean |
| 132 | ContactImageManager.kt | `resizeBitmap` | fun resizeBitmap(context: Context, bitmap: Bitmap, maxSize: Int = MAX_IMAGE_SIZE): File? |
| 133 | ContactImageManager.kt | `resizeImage` | fun resizeImage(context: Context, uri: Uri, maxSize: Int = MAX_IMAGE_SIZE): File? |
| 134 | ContactMapper.kt | `ContactEntity` | fun ContactEntity.toContactFormState(): ContactFormState |
| 135 | ContactMapper.kt | `ContactFormState` | fun ContactFormState.toContactEntity( |
| 136 | ContactMapper.kt | `detectContactChangedFields` | fun detectContactChangedFields(original: ContactEntity?, form: ContactFormState): Set<String> |
| 137 | ContactPushMapper.kt | `ContactEntity` | fun ContactEntity.toPushDto(): ContactPushDto |
| 138 | ContactPushMapper.kt | `parseDirtyFieldsList` | private fun parseDirtyFieldsList(json: String?): List<String>? |
| 139 | SettingsPayloadMapper.kt | `Map` | private fun Map<String, Any?>.getString(key: String): String? |
| 140 | SettingsPayloadMapper.kt | `mapFormStateToPayload` | fun mapFormStateToPayload(formState: SettingsFormState): Map<String, Any?> |
| 141 | SettingsPayloadMapper.kt | `mapPayloadToFormState` | fun mapPayloadToFormState(payload: Map<String, Any?>): SettingsFormState |
| 142 | SettingsPayloadMapper.kt | `mergePayload` | fun mergePayload( |
| 143 | SettingsPayloadMapper.kt | `parseJsonOrRaw` | private fun parseJsonOrRaw(jsonString: String): Any? |
| 144 | SettingsPushMapper.kt | `SettingsEntity` | fun SettingsEntity.toPushDto(): SettingsPushDto |
| 145 | VCardBuilder.kt | `addMultiValue` | private fun addMultiValue(lines: MutableList<String>, prop: String, json: String?) |
| 146 | VCardBuilder.kt | `build` | fun build(contact: ContactEntity): String |
| 147 | VCardBuilder.kt | `byteSize` | fun byteSize(vcard: String): Int = vcard.toByteArray(Charsets.UTF_8).size |
| 148 | VCardBuilder.kt | `fitsInQr` | fun fitsInQr(vcard: String): Boolean = byteSize(vcard) <= MAX_QR_BYTES |
| 149 | VCardBuilder.kt | `parseMultiValue` | private fun parseMultiValue(json: String?): List<Map<String, Any?>>? |

## data/remote/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 150 | AuthInterceptor.kt | `intercept` | override fun intercept(chain: Interceptor.Chain): Response |
| 151 | CwocApiService.kt | `archiveOriginal` | suspend fun archiveOriginal( |
| 152 | CwocApiService.kt | `authenticate` | suspend fun authenticate( |
| 153 | CwocApiService.kt | `connectTailscale` | suspend fun connectTailscale(): Response<TailscaleConnectResponse> |
| 154 | CwocApiService.kt | `createBundle` | suspend fun createBundle( |
| 155 | CwocApiService.kt | `createStandaloneAlert` | suspend fun createStandaloneAlert( |
| 156 | CwocApiService.kt | `deleteAttachment` | suspend fun deleteAttachment( |
| 157 | CwocApiService.kt | `deleteBundle` | suspend fun deleteBundle( |
| 158 | CwocApiService.kt | `deleteContactImage` | suspend fun deleteContactImage( |
| 159 | CwocApiService.kt | `deleteStandaloneAlert` | suspend fun deleteStandaloneAlert( |
| 160 | CwocApiService.kt | `disableBundle` | suspend fun disableBundle( |
| 161 | CwocApiService.kt | `disableNtfy` | suspend fun disableNtfy(): Response<NtfyToggleResponse> |
| 162 | CwocApiService.kt | `disconnectTailscale` | suspend fun disconnectTailscale(): Response<TailscaleDisconnectResponse> |
| 163 | CwocApiService.kt | `dismissConflict` | suspend fun dismissConflict( |
| 164 | CwocApiService.kt | `dismissNotification` | suspend fun dismissNotification( |
| 165 | CwocApiService.kt | `downloadAttachment` | suspend fun downloadAttachment( |
| 166 | CwocApiService.kt | `downloadRawEmail` | suspend fun downloadRawEmail( |
| 167 | CwocApiService.kt | `emailBackfillEstimate` | suspend fun emailBackfillEstimate(): Response<EmailBackfillEstimateResponse> |
| 168 | CwocApiService.kt | `emailSync` | suspend fun emailSync( |
| 169 | CwocApiService.kt | `enableBundle` | suspend fun enableBundle( |
| 170 | CwocApiService.kt | `enableNtfy` | suspend fun enableNtfy(): Response<NtfyToggleResponse> |
| 171 | CwocApiService.kt | `exportAll` | suspend fun exportAll(): Response<ResponseBody> |
| 172 | CwocApiService.kt | `exportChits` | suspend fun exportChits(): Response<ResponseBody> |
| 173 | CwocApiService.kt | `exportContacts` | suspend fun exportContacts( |
| 174 | CwocApiService.kt | `exportSingleContact` | suspend fun exportSingleContact( |
| 175 | CwocApiService.kt | `exportUsers` | suspend fun exportUsers(): Response<ResponseBody> |
| 176 | CwocApiService.kt | `getBundles` | suspend fun getBundles(): Response<BundlesResponse> |
| 177 | CwocApiService.kt | `getContactBirthdays` | suspend fun getContactBirthdays(): Response<List<Map<String, Any?>>> |
| 178 | CwocApiService.kt | `getCustomObjectsForZone` | suspend fun getCustomObjectsForZone( |
| 179 | CwocApiService.kt | `getDiskUsage` | suspend fun getDiskUsage(): Response<DiskUsageResponse> |
| 180 | CwocApiService.kt | `getDocContent` | suspend fun getDocContent( |
| 181 | CwocApiService.kt | `getDocsIndex` | suspend fun getDocsIndex(): Response<DocsIndexResponse> |
| 182 | CwocApiService.kt | `getHaConfig` | suspend fun getHaConfig(): Response<HaConfigResponse> |
| 183 | CwocApiService.kt | `getLoginMessage` | suspend fun getLoginMessage(): Response<LoginMessageResponse> |
| 184 | CwocApiService.kt | `getMe` | suspend fun getMe(): Response<UserProfileResponse> |
| 185 | CwocApiService.kt | `getNotifications` | suspend fun getNotifications( |
| 186 | CwocApiService.kt | `getNtfyStatus` | suspend fun getNtfyStatus(): Response<NtfyStatusResponse> |
| 187 | CwocApiService.kt | `getPrivatePgpKey` | suspend fun getPrivatePgpKey( |
| 188 | CwocApiService.kt | `getReleaseNotes` | suspend fun getReleaseNotes(): Response<ReleaseNotesResponse> |
| 189 | CwocApiService.kt | `getSettings` | suspend fun getSettings( |
| 190 | CwocApiService.kt | `getSortOrders` | suspend fun getSortOrders(): Response<Map<String, List<String>>> |
| 191 | CwocApiService.kt | `getSortPreferences` | suspend fun getSortPreferences(): Response<Map<String, Map<String, String>>> |
| 192 | CwocApiService.kt | `getStandaloneAlerts` | suspend fun getStandaloneAlerts(): Response<List<StandaloneAlertDto>> |
| 193 | CwocApiService.kt | `getSwitchableUsers` | suspend fun getSwitchableUsers(): Response<List<SwitchableUserDto>> |
| 194 | CwocApiService.kt | `getSyncChanges` | suspend fun getSyncChanges( |
| 195 | CwocApiService.kt | `getTailscaleStatus` | suspend fun getTailscaleStatus(): Response<TailscaleStatusResponse> |
| 196 | CwocApiService.kt | `getTrashContacts` | suspend fun getTrashContacts(): Response<List<Map<String, Any?>>> |
| 197 | CwocApiService.kt | `getUpdateLog` | suspend fun getUpdateLog(): Response<UpdateLogResponse> |
| 198 | CwocApiService.kt | `getVersion` | suspend fun getVersion(): Response<VersionResponse> |
| 199 | CwocApiService.kt | `getWeatherForecasts` | suspend fun getWeatherForecasts(): Response<com.cwoc.app.ui.screens.weather.WeatherForecastsResponse> |
| 200 | CwocApiService.kt | `importAll` | suspend fun importAll( |
| 201 | CwocApiService.kt | `importChits` | suspend fun importChits( |
| 202 | CwocApiService.kt | `importContacts` | suspend fun importContacts( |
| 203 | CwocApiService.kt | `importUserdata` | suspend fun importUserdata( |
| 204 | CwocApiService.kt | `markEmailRead` | suspend fun markEmailRead( |
| 205 | CwocApiService.kt | `patchChecklist` | suspend fun patchChecklist( |
| 206 | CwocApiService.kt | `patchRsvp` | suspend fun patchRsvp( |
| 207 | CwocApiService.kt | `postClientLog` | suspend fun postClientLog( |
| 208 | CwocApiService.kt | `purgeContact` | suspend fun purgeContact( |
| 209 | CwocApiService.kt | `pushChanges` | suspend fun pushChanges( |
| 210 | CwocApiService.kt | `regenerateHaWebhook` | suspend fun regenerateHaWebhook(): Response<HaWebhookRegenerateResponse> |
| 211 | CwocApiService.kt | `reorderBundles` | suspend fun reorderBundles( |
| 212 | CwocApiService.kt | `resetSortOrders` | suspend fun resetSortOrders(): Response<ResetSortOrdersResponse> |
| 213 | CwocApiService.kt | `restartService` | suspend fun restartService(): Response<RestartResponse> |
| 214 | CwocApiService.kt | `restoreContact` | suspend fun restoreContact( |
| 215 | CwocApiService.kt | `saveHaConfig` | suspend fun saveHaConfig( |
| 216 | CwocApiService.kt | `saveSettings` | suspend fun saveSettings( |
| 217 | CwocApiService.kt | `saveSortOrder` | suspend fun saveSortOrder( |
| 218 | CwocApiService.kt | `saveSortPreference` | suspend fun saveSortPreference( |
| 219 | CwocApiService.kt | `saveTailscaleConfig` | suspend fun saveTailscaleConfig( |
| 220 | CwocApiService.kt | `scheduleEmail` | suspend fun scheduleEmail( |
| 221 | CwocApiService.kt | `sendEmail` | suspend fun sendEmail( |
| 222 | CwocApiService.kt | `snoozeNotification` | suspend fun snoozeNotification( |
| 223 | CwocApiService.kt | `streamUpgrade` | suspend fun streamUpgrade(): Response<ResponseBody> |
| 224 | CwocApiService.kt | `testEmailConnection` | suspend fun testEmailConnection( |
| 225 | CwocApiService.kt | `testHaConnection` | suspend fun testHaConnection(): Response<HaTestResponse> |
| 226 | CwocApiService.kt | `testNtfy` | suspend fun testNtfy(): Response<NtfyTestResponse> |
| 227 | CwocApiService.kt | `toggleContactFavorite` | suspend fun toggleContactFavorite( |
| 228 | CwocApiService.kt | `updateBundle` | suspend fun updateBundle( |
| 229 | CwocApiService.kt | `updateNotification` | suspend fun updateNotification( |
| 230 | CwocApiService.kt | `updateStandaloneAlert` | suspend fun updateStandaloneAlert( |
| 231 | CwocApiService.kt | `uploadAttachment` | suspend fun uploadAttachment( |
| 232 | CwocApiService.kt | `uploadContactImage` | suspend fun uploadContactImage( |
| 233 | TokenAuthenticator.kt | `authenticate` | override fun authenticate(route: Route?, response: Response): Request? |
| 234 | TokenAuthenticator.kt | `reset` | fun reset() |

## data/repository/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 235 | AuthEventEmitter.kt | `emitTokenRevokedSync` | fun emitTokenRevokedSync() |
| 236 | AuthRepository.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| 237 | AuthRepository.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| 238 | AuthRepository.kt | `clearToken` | fun clearToken() |
| 239 | AuthRepository.kt | `emitTokenRevoked` | suspend fun emitTokenRevoked() |
| 240 | AuthRepository.kt | `emitTokenRevokedSync` | override fun emitTokenRevokedSync() |
| 241 | AuthRepository.kt | `fetchUserProfile` | suspend fun fetchUserProfile() |
| 242 | AuthRepository.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf() |
| 243 | AuthRepository.kt | `getLastServerUrl` | fun getLastServerUrl(): String? |
| 244 | AuthRepository.kt | `isAuthenticated` | fun isAuthenticated(): Boolean |
| 245 | AuthRepository.kt | `login` | suspend fun login(serverUrl: String, username: String, password: String): AuthResult |
| 246 | BundleRepository.kt | `createBundle` | suspend fun createBundle( |
| 247 | BundleRepository.kt | `deleteBundle` | suspend fun deleteBundle(id: String): Result<Unit> |
| 248 | BundleRepository.kt | `disableBundle` | suspend fun disableBundle(id: String): Result<Unit> |
| 249 | BundleRepository.kt | `enableBundle` | suspend fun enableBundle(id: String): Result<Unit> |
| 250 | BundleRepository.kt | `fetchBundles` | suspend fun fetchBundles(): Result<List<BundleDto>> |
| 251 | BundleRepository.kt | `reorderBundles` | suspend fun reorderBundles(orderedIds: List<String>): Result<Unit> |
| 252 | BundleRepository.kt | `updateBundle` | suspend fun updateBundle( |
| 253 | ChitRepository.kt | `archive` | suspend fun archive(chitId: String) |
| 254 | ChitRepository.kt | `decrementHabitSuccess` | suspend fun decrementHabitSuccess(chitId: String) |
| 255 | ChitRepository.kt | `getAlertChits` | fun getAlertChits(): Flow<List<ChitEntity>> = chitDao.getAlertChits() |
| 256 | ChitRepository.kt | `getAllNonDeleted` | fun getAllNonDeleted(): Flow<List<ChitEntity>> = chitDao.getAllNonDeleted() |
| 257 | ChitRepository.kt | `getById` | suspend fun getById(id: String): ChitEntity? = chitDao.getById(id) |
| 258 | ChitRepository.kt | `getCalendarChits` | fun getCalendarChits(): Flow<List<ChitEntity>> = chitDao.getCalendarChits() |
| 259 | ChitRepository.kt | `getChecklistChits` | fun getChecklistChits(): Flow<List<ChitEntity>> = chitDao.getChecklistChits() |
| 260 | ChitRepository.kt | `getChitsByIds` | suspend fun getChitsByIds(ids: List<String>): List<ChitEntity> = chitDao.getChitsByIds(ids) |
| 261 | ChitRepository.kt | `getChitsForDay` | fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> |
| 262 | ChitRepository.kt | `getCount` | suspend fun getCount(): Int = chitDao.getCount() |
| 263 | ChitRepository.kt | `getDeletedChits` | fun getDeletedChits(): Flow<List<ChitEntity>> = chitDao.getDeletedChits() |
| 264 | ChitRepository.kt | `getIndicatorChits` | fun getIndicatorChits(): Flow<List<ChitEntity>> = chitDao.getIndicatorChits() |
| 265 | ChitRepository.kt | `getLocationChits` | fun getLocationChits(): Flow<List<ChitEntity>> = chitDao.getLocationChits() |
| 266 | ChitRepository.kt | `getNoteChits` | fun getNoteChits(): Flow<List<ChitEntity>> = chitDao.getNoteChits() |
| 267 | ChitRepository.kt | `getProjectMasterChits` | fun getProjectMasterChits(): Flow<List<ChitEntity>> = chitDao.getProjectMasterChits() |
| 268 | ChitRepository.kt | `getRecurringChits` | fun getRecurringChits(): Flow<List<ChitEntity>> |
| 269 | ChitRepository.kt | `getTaskChits` | fun getTaskChits(): Flow<List<ChitEntity>> = chitDao.getTaskChits() |
| 270 | ChitRepository.kt | `getTasksByStatus` | fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = chitDao.getTasksByStatus(status) |
| 271 | ChitRepository.kt | `incrementHabitSuccess` | suspend fun incrementHabitSuccess(chitId: String) |
| 272 | ChitRepository.kt | `markDirty` | suspend fun markDirty(id: String, field: String) |
| 273 | ChitRepository.kt | `pin` | suspend fun pin(chitId: String) |
| 274 | ChitRepository.kt | `snooze` | suspend fun snooze(chitId: String, until: String) |
| 275 | ChitRepository.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline(chitId: String) |
| 276 | ChitRepository.kt | `unarchive` | suspend fun unarchive(chitId: String) |
| 277 | ChitRepository.kt | `unpin` | suspend fun unpin(chitId: String) |
| 278 | ChitRepository.kt | `unsnooze` | suspend fun unsnooze(chitId: String) |
| 279 | ChitRepository.kt | `updateDateTimes` | suspend fun updateDateTimes( |
| 280 | ChitRepository.kt | `updateRsvp` | suspend fun updateRsvp(chitId: String, rsvpStatus: String): Boolean |
| 281 | ChitRepository.kt | `updateStatus` | suspend fun updateStatus(chitId: String, newStatus: String) |
| 282 | ChitRepository.kt | `updateTitleAndNote` | suspend fun updateTitleAndNote(chitId: String, title: String, note: String) |
| 283 | ContactRepository.kt | `create` | suspend fun create(contact: ContactEntity) |
| 284 | ContactRepository.kt | `delete` | suspend fun delete(contactId: String) |
| 285 | ContactRepository.kt | `deleteImage` | suspend fun deleteImage(contactId: String) |
| 286 | ContactRepository.kt | `exportAll` | suspend fun exportAll(context: Context, format: String): File? |
| 287 | ContactRepository.kt | `exportSingle` | suspend fun exportSingle(context: Context, contactId: String): File? |
| 288 | ContactRepository.kt | `getById` | suspend fun getById(id: String): ContactEntity? |
| 289 | ContactRepository.kt | `getFavorites` | fun getFavorites(): Flow<List<ContactEntity>> |
| 290 | ContactRepository.kt | `getNonFavoriteOwned` | fun getNonFavoriteOwned(): Flow<List<ContactEntity>> |
| 291 | ContactRepository.kt | `getSwitchableUsers` | suspend fun getSwitchableUsers(): List<SwitchableUserDto> |
| 292 | ContactRepository.kt | `getTrashContacts` | fun getTrashContacts(): Flow<List<ContactEntity>> |
| 293 | ContactRepository.kt | `getVaultContacts` | fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>> |
| 294 | ContactRepository.kt | `importFile` | suspend fun importFile(context: Context, uri: Uri, filename: String): ImportResultDto? |
| 295 | ContactRepository.kt | `purgeFromTrash` | suspend fun purgeFromTrash(contactId: String) |
| 296 | ContactRepository.kt | `restoreFromTrash` | suspend fun restoreFromTrash(contactId: String) |
| 297 | ContactRepository.kt | `searchContacts` | fun searchContacts(query: String): Flow<List<ContactEntity>> |
| 298 | ContactRepository.kt | `toggleFavorite` | suspend fun toggleFavorite(contactId: String): Boolean |
| 299 | ContactRepository.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline() |
| 300 | ContactRepository.kt | `update` | suspend fun update(contact: ContactEntity, changedFields: Set<String>) |
| 301 | ContactRepository.kt | `uploadImage` | suspend fun uploadImage(contactId: String, imageFile: File): String? |
| 302 | EmailRepository.kt | `archiveOriginal` | suspend fun archiveOriginal(inReplyToMessageId: String): Result<Unit> |
| 303 | EmailRepository.kt | `backfillEstimate` | suspend fun backfillEstimate(): Result<EmailBackfillEstimateResponse> |
| 304 | EmailRepository.kt | `cancelSchedule` | suspend fun cancelSchedule(chitId: String): Result<Unit> |
| 305 | EmailRepository.kt | `downloadRawEml` | suspend fun downloadRawEml(chitId: String): Result<ByteArray> |
| 306 | EmailRepository.kt | `getPrivatePgpKey` | suspend fun getPrivatePgpKey(password: String): Result<String> |
| 307 | EmailRepository.kt | `markRead` | suspend fun markRead(chitId: String, read: Boolean): Result<Unit> |
| 308 | EmailRepository.kt | `scheduleEmail` | suspend fun scheduleEmail(chitId: String, sendAt: String): Result<Unit> |
| 309 | EmailRepository.kt | `sendEmail` | suspend fun sendEmail(chitId: String): Result<EmailSendResponse> |
| 310 | EmailRepository.kt | `syncEmail` | suspend fun syncEmail(backfill: Boolean = false): Result<EmailSyncResponse> |
| 311 | EmailRepository.kt | `testConnection` | suspend fun testConnection(config: Map<String, Any?>): Result<EmailTestConnectionResponse> |
| 312 | SettingsRepository.kt | `clearDirty` | suspend fun clearDirty() |
| 313 | SettingsRepository.kt | `get` | suspend fun get(): SettingsEntity? |
| 314 | SettingsRepository.kt | `replaceWithServerVersion` | suspend fun replaceWithServerVersion(settings: SettingsEntity) |
| 315 | SettingsRepository.kt | `update` | suspend fun update(settings: SettingsEntity) |
| 316 | StandaloneAlertRepository.kt | `StandaloneAlertDto` | private fun StandaloneAlertDto.toEntity(): StandaloneAlertEntity |
| 317 | StandaloneAlertRepository.kt | `create` | suspend fun create(type: String, name: String?, data: Map<String, Any?>): Result<StandaloneAlertDto> |
| 318 | StandaloneAlertRepository.kt | `delete` | suspend fun delete(id: String): Result<Unit> |
| 319 | StandaloneAlertRepository.kt | `fetchAndCache` | suspend fun fetchAndCache() |
| 320 | StandaloneAlertRepository.kt | `getAll` | fun getAll(): Flow<List<StandaloneAlertEntity>> = standaloneAlertDao.getAll() |
| 321 | StandaloneAlertRepository.kt | `getByType` | fun getByType(type: String): Flow<List<StandaloneAlertEntity>> = standaloneAlertDao.getByType(type) |
| 322 | StandaloneAlertRepository.kt | `update` | suspend fun update(id: String, body: Map<String, Any?>): Result<Unit> |
| 323 | SyncRepository.kt | `getHighWaterMark` | suspend fun getHighWaterMark(): Int |
| 324 | SyncRepository.kt | `getSyncMetadata` | suspend fun getSyncMetadata(): SyncMetadataEntity? |
| 325 | SyncRepository.kt | `performIncrementalSync` | suspend fun performIncrementalSync(): SyncResult |
| 326 | SyncRepository.kt | `performInitialSync` | suspend fun performInitialSync(): SyncResult |

## data/sync/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 327 | ConnectivityMonitor.kt | `checkCurrentConnectivity` | private fun checkCurrentConnectivity(): Boolean |
| 328 | ConnectivityMonitor.kt | `hasActiveNetwork` | private fun hasActiveNetwork(): Boolean |
| 329 | ConnectivityMonitor.kt | `onAvailable` | override fun onAvailable(network: Network) |
| 330 | ConnectivityMonitor.kt | `onCapabilitiesChanged` | override fun onCapabilitiesChanged( |
| 331 | ConnectivityMonitor.kt | `onLost` | override fun onLost(network: Network) |
| 332 | DirtyTracker.kt | `clearContactDirty` | suspend fun clearContactDirty(contactId: String) |
| 333 | DirtyTracker.kt | `clearDirty` | suspend fun clearDirty(chitId: String) |
| 334 | DirtyTracker.kt | `clearDirtyWithMerge` | suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity) |
| 335 | DirtyTracker.kt | `clearSettingsDirty` | suspend fun clearSettingsDirty() |
| 336 | DirtyTracker.kt | `markContactDirty` | suspend fun markContactDirty(contactId: String, changedFields: Set<String>) |
| 337 | DirtyTracker.kt | `markDirty` | suspend fun markDirty(chitId: String, changedFields: Set<String>) |
| 338 | DirtyTracker.kt | `markSettingsDirty` | suspend fun markSettingsDirty() |
| 339 | DirtyTracker.kt | `parseDirtyFields` | private fun parseDirtyFields(json: String?): Set<String> |
| 340 | DirtyTracker.kt | `serializeDirtyFields` | private fun serializeDirtyFields(fields: Set<String>): String |
| 341 | DtoMappers.kt | `Any` | private fun Any?.toJsonString(gson: Gson): String? |
| 342 | DtoMappers.kt | `ChitDto` | fun ChitDto.toEntity(syncedAt: String, gson: Gson): ChitEntity |
| 343 | DtoMappers.kt | `ContactDto` | fun ContactDto.toEntity(syncedAt: String, gson: Gson): ContactEntity |
| 344 | DtoMappers.kt | `SettingsDto` | fun SettingsDto.toEntity(syncedAt: String, gson: Gson): SettingsEntity |
| 345 | EdgeCaseHandler.kt | `applyChecklistMerge` | suspend fun applyChecklistMerge(chitId: String, serverChecklist: String) |
| 346 | EdgeCaseHandler.kt | `applyTagRename` | suspend fun applyTagRename(oldTag: String, newTag: String) |
| 347 | EdgeCaseHandler.kt | `handleServerDeletion` | suspend fun handleServerDeletion(chitId: String) |
| 348 | EdgeCaseHandler.kt | `parseDirtyFields` | private fun parseDirtyFields(json: String?): List<String> |
| 349 | LostEditLogger.kt | `clear` | fun clear() |
| 350 | LostEditLogger.kt | `getEntries` | fun getEntries(): List<LostEditEntry> |
| 351 | LostEditLogger.kt | `logLostEdit` | fun logLostEdit(chitId: String, title: String?, dirtyFields: List<String>) |
| 352 | PushSyncWorker.kt | `cancel` | fun cancel(context: Context) |
| 353 | PushSyncWorker.kt | `enqueueOnce` | fun enqueueOnce(context: Context) |
| 354 | SyncEngine.kt | `buildApiService` | private fun buildApiService(): CwocApiService? |
| 355 | SyncEngine.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| 356 | SyncEngine.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| 357 | SyncEngine.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf() |
| 358 | SyncEngine.kt | `performSync` | suspend fun performSync(since: Int = 0): SyncResult |
| 359 | SyncEngine.kt | `reportLog` | suspend fun reportLog(message: String, level: String = "info") |
| 360 | SyncOrchestrator.kt | `handleOffline` | private fun handleOffline() |
| 361 | SyncOrchestrator.kt | `handleOnline` | private fun handleOnline() |
| 362 | SyncOrchestrator.kt | `start` | fun start() |
| 363 | SyncPushEngine.kt | `pushAll` | suspend fun pushAll(): PushResult |
| 364 | SyncPushEngine.kt | `pushSingle` | suspend fun pushSingle(chitId: String): PushResult |
| 365 | SyncStateManager.kt | `deriveState` | private fun deriveState(isOnline: Boolean, isSyncing: Boolean): SyncState |
| 366 | SyncStateManager.kt | `setIdle` | fun setIdle() |
| 367 | SyncStateManager.kt | `setSyncing` | fun setSyncing() |
| 368 | SyncWorker.kt | `cancel` | fun cancel(context: Context) |
| 369 | SyncWorker.kt | `enqueue` | fun enqueue(context: Context) |
| 370 | WebSocketClient.kt | `buildWebSocketUrl` | private fun buildWebSocketUrl(): String? |
| 371 | WebSocketClient.kt | `connect` | fun connect() |
| 372 | WebSocketClient.kt | `disconnect` | fun disconnect() |
| 373 | WebSocketClient.kt | `establishConnection` | private fun establishConnection() |
| 374 | WebSocketClient.kt | `onClosed` | override fun onClosed(webSocket: WebSocket, code: Int, reason: String) |
| 375 | WebSocketClient.kt | `onClosing` | override fun onClosing(webSocket: WebSocket, code: Int, reason: String) |
| 376 | WebSocketClient.kt | `onFailure` | override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) |
| 377 | WebSocketClient.kt | `onMessage` | override fun onMessage(webSocket: WebSocket, text: String) |
| 378 | WebSocketClient.kt | `onOpen` | override fun onOpen(webSocket: WebSocket, response: Response) |
| 379 | WebSocketClient.kt | `parseMessage` | private fun parseMessage(text: String): WebSocketMessage? |
| 380 | WebSocketClient.kt | `scheduleReconnect` | private fun scheduleReconnect() |

## di/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 381 | AppModule.kt | `provideAttachmentMetadataDao` | fun provideAttachmentMetadataDao(db: CwocDatabase): AttachmentMetadataDao = db.attachmentMetadataDao() |
| 382 | AppModule.kt | `provideChitDao` | fun provideChitDao(db: CwocDatabase): ChitDao = db.chitDao() |
| 383 | AppModule.kt | `provideContactDao` | fun provideContactDao(db: CwocDatabase): ContactDao = db.contactDao() |
| 384 | AppModule.kt | `provideCwocDatabase` | fun provideCwocDatabase( |
| 385 | AppModule.kt | `provideEncryptedSharedPreferences` | fun provideEncryptedSharedPreferences( |
| 386 | AppModule.kt | `provideNotificationDao` | fun provideNotificationDao(db: CwocDatabase): NotificationDao = db.notificationDao() |
| 387 | AppModule.kt | `provideSettingsDao` | fun provideSettingsDao(db: CwocDatabase): SettingsDao = db.settingsDao() |
| 388 | AppModule.kt | `provideStandaloneAlertDao` | fun provideStandaloneAlertDao(db: CwocDatabase): StandaloneAlertDao = db.standaloneAlertDao() |
| 389 | AppModule.kt | `provideSyncMetadataDao` | fun provideSyncMetadataDao(db: CwocDatabase): SyncMetadataDao = db.syncMetadataDao() |
| 390 | NetworkModule.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| 391 | NetworkModule.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| 392 | NetworkModule.kt | `emitTokenRevokedSync` | override fun emitTokenRevokedSync() |
| 393 | NetworkModule.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf() |
| 394 | NetworkModule.kt | `provideAuthEventEmitter` | fun provideAuthEventEmitter(authRepository: dagger.Lazy<AuthRepository>): AuthEventEmitter |
| 395 | NetworkModule.kt | `provideAuthInterceptor` | fun provideAuthInterceptor(prefs: SharedPreferences): AuthInterceptor |
| 396 | NetworkModule.kt | `provideCwocApiService` | fun provideCwocApiService(retrofit: Retrofit): CwocApiService |
| 397 | NetworkModule.kt | `provideGson` | fun provideGson(): Gson |
| 398 | NetworkModule.kt | `provideLoggingInterceptor` | fun provideLoggingInterceptor(): HttpLoggingInterceptor |
| 399 | NetworkModule.kt | `provideOkHttpClient` | fun provideOkHttpClient( |
| 400 | NetworkModule.kt | `provideRetrofit` | fun provideRetrofit( |
| 401 | NetworkModule.kt | `provideTokenAuthenticator` | fun provideTokenAuthenticator( |
| 402 | SyncModule.kt | `bindAttachmentCache` | abstract fun bindAttachmentCache( |
| 403 | SyncModule.kt | `bindAttachmentManager` | abstract fun bindAttachmentManager( |
| 404 | SyncModule.kt | `bindBundleRepository` | abstract fun bindBundleRepository( |
| 405 | SyncModule.kt | `bindConnectivityMonitor` | abstract fun bindConnectivityMonitor( |
| 406 | SyncModule.kt | `bindContactRepository` | abstract fun bindContactRepository( |
| 407 | SyncModule.kt | `bindDirtyTracker` | abstract fun bindDirtyTracker( |
| 408 | SyncModule.kt | `bindEdgeCaseHandler` | abstract fun bindEdgeCaseHandler( |
| 409 | SyncModule.kt | `bindEmailRepository` | abstract fun bindEmailRepository( |
| 410 | SyncModule.kt | `bindNotificationScheduler` | abstract fun bindNotificationScheduler( |
| 411 | SyncModule.kt | `bindSettingsRepository` | abstract fun bindSettingsRepository( |
| 412 | SyncModule.kt | `bindSyncPushEngine` | abstract fun bindSyncPushEngine( |
| 413 | SyncModule.kt | `bindSyncStateManager` | abstract fun bindSyncStateManager( |
| 414 | SyncModule.kt | `bindWebSocketClient` | abstract fun bindWebSocketClient( |

## domain/alerts/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 415 | AlertClassifier.kt | `classifyAlerts` | fun classifyAlerts( |
| 416 | AlertClassifier.kt | `parseAlertTime` | private fun parseAlertTime(datetime: String?): LocalDateTime? |
| 417 | AlertClassifier.kt | `parseAlerts` | fun parseAlerts(json: String?): List<RawAlert> |
| 418 | StopwatchRuntime.kt | `emitState` | private fun emitState() |
| 419 | StopwatchRuntime.kt | `formatElapsed` | fun formatElapsed(ms: Long): String |
| 420 | StopwatchRuntime.kt | `lap` | fun lap() |
| 421 | StopwatchRuntime.kt | `pause` | fun pause() |
| 422 | StopwatchRuntime.kt | `reset` | fun reset() |
| 423 | StopwatchRuntime.kt | `start` | fun start() |
| 424 | TimerRuntime.kt | `emitState` | private fun emitState() |
| 425 | TimerRuntime.kt | `pause` | fun pause() |
| 426 | TimerRuntime.kt | `reset` | fun reset() |
| 427 | TimerRuntime.kt | `setDuration` | fun setDuration(hours: Int, minutes: Int, seconds: Int) |
| 428 | TimerRuntime.kt | `start` | fun start() |
| 429 | TimerRuntime.kt | `startTicking` | private fun startTicking() |

## domain/chart/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 430 | ChartDataTransformer.kt | `filterByRange` | fun filterByRange( |
| 431 | ChartDataTransformer.kt | `groupByType` | fun groupByType(points: List<ChartDataPoint>): Map<String, List<ChartDataPoint>> |
| 432 | ChartDataTransformer.kt | `hitTest` | fun hitTest( |
| 433 | ChartDataTransformer.kt | `mapToPixels` | fun mapToPixels( |
| 434 | ChartDataTransformer.kt | `parseHealthData` | fun parseHealthData(json: String?): List<ChartDataPoint> |

## domain/checklist/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 435 | ChecklistOperations.kt | `indentationDp` | fun indentationDp(indent: Int): Int |
| 436 | ChecklistOperations.kt | `parseChecklist` | fun parseChecklist(json: String?): List<ChecklistItem> |
| 437 | ChecklistOperations.kt | `reorderChecklistItem` | fun reorderChecklistItem( |
| 438 | ChecklistOperations.kt | `serializeChecklist` | fun serializeChecklist(items: List<ChecklistItem>): String |
| 439 | ChecklistOperations.kt | `toggleChecklistItem` | fun toggleChecklistItem(items: List<ChecklistItem>, index: Int): List<ChecklistItem> |
| 440 | ChecklistOperationsV2.kt | `addItem` | fun addItem( |
| 441 | ChecklistOperationsV2.kt | `deleteWithSubtree` | fun deleteWithSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 442 | ChecklistOperationsV2.kt | `findParentForLevel` | private fun findParentForLevel(items: List<ChecklistItemV2>, idx: Int, targetLevel: Int): String? |
| 443 | ChecklistOperationsV2.kt | `generateId` | fun generateId(): String = UUID.randomUUID().toString() |
| 444 | ChecklistOperationsV2.kt | `getChildren` | fun getChildren(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 445 | ChecklistOperationsV2.kt | `getGhostParents` | fun getGhostParents(items: List<ChecklistItemV2>): Set<String> |
| 446 | ChecklistOperationsV2.kt | `getParent` | fun getParent(items: List<ChecklistItemV2>, item: ChecklistItemV2): ChecklistItemV2? |
| 447 | ChecklistOperationsV2.kt | `getSubtree` | fun getSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 448 | ChecklistOperationsV2.kt | `indent` | fun indent(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 449 | ChecklistOperationsV2.kt | `indentSubtree` | fun indentSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 450 | ChecklistOperationsV2.kt | `isDescendant` | private fun isDescendant( |
| 451 | ChecklistOperationsV2.kt | `itemsToMarkdown` | fun itemsToMarkdown(items: List<ChecklistItemV2>): String |
| 452 | ChecklistOperationsV2.kt | `moveAbove` | fun moveAbove( |
| 453 | ChecklistOperationsV2.kt | `moveBelow` | fun moveBelow( |
| 454 | ChecklistOperationsV2.kt | `moveOnto` | fun moveOnto( |
| 455 | ChecklistOperationsV2.kt | `outdent` | fun outdent(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 456 | ChecklistOperationsV2.kt | `outdentSubtree` | fun outdentSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| 457 | ChecklistOperationsV2.kt | `parse` | fun parse(json: String?): List<ChecklistItemV2> |
| 458 | ChecklistOperationsV2.kt | `parseClipboardText` | fun parseClipboardText(text: String): List<ChecklistItemV2> |
| 459 | ChecklistOperationsV2.kt | `serialize` | fun serialize(items: List<ChecklistItemV2>): String |
| 460 | ChecklistOperationsV2.kt | `splitItem` | fun splitItem( |
| 461 | ChecklistOperationsV2.kt | `toggleCheck` | fun toggleCheck(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |

## domain/email/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 462 | AutocompleteSearch.kt | `extractEmails` | private fun extractEmails(emailsJson: String?): List<String> |
| 463 | AutocompleteSearch.kt | `isAlreadyChipped` | private fun isAlreadyChipped(contact: ContactEntity, chipsLower: Set<String>): Boolean |
| 464 | AutocompleteSearch.kt | `matchesQuery` | private fun matchesQuery(contact: ContactEntity, lowerQuery: String): Boolean |
| 465 | AutocompleteSearch.kt | `search` | fun search( |
| 466 | BodyPreviewStripper.kt | `decodeHtmlEntities` | private fun decodeHtmlEntities(text: String): String |
| 467 | BodyPreviewStripper.kt | `strip` | fun strip(body: String?): String |
| 468 | ContrastColor.kt | `contrastRatio` | fun contrastRatio(fg: Color, bg: Color): Double |
| 469 | ContrastColor.kt | `forBackground` | fun forBackground(backgroundColor: Color): Color |
| 470 | ContrastColor.kt | `linearize` | private fun linearize(srgb: Double): Double |
| 471 | ContrastColor.kt | `relativeLuminance` | private fun relativeLuminance(color: Color): Double |
| 472 | DateGrouper.kt | `assign` | fun assign(dateStr: String?): DateGroup |
| 473 | DateGrouper.kt | `parseToLocalDate` | private fun parseToLocalDate(dateStr: String): LocalDate? |
| 474 | DraftDetector.kt | `findExistingForward` | fun findExistingForward(drafts: List<ChitEntity>, originalSubject: String?): ChitEntity? |
| 475 | DraftDetector.kt | `findExistingReply` | fun findExistingReply(drafts: List<ChitEntity>, originalMessageId: String?): ChitEntity? |
| 476 | DraftDetector.kt | `normalizeSubject` | private fun normalizeSubject(subject: String): String |
| 477 | EmailDateFormatter.kt | `format` | fun format(dateStr: String?, use24Hour: Boolean = false): String |
| 478 | EmailDateFormatter.kt | `parseDateTime` | private fun parseDateTime(dateStr: String): LocalDateTime? |
| 479 | MarkdownFormatter.kt | `applyBlockquote` | fun applyBlockquote(text: String, selection: TextSelection): String |
| 480 | MarkdownFormatter.kt | `applyBold` | fun applyBold(text: String, selection: TextSelection): String |
| 481 | MarkdownFormatter.kt | `applyBulletList` | fun applyBulletList(text: String, lineStart: Int): String |
| 482 | MarkdownFormatter.kt | `applyHeading` | fun applyHeading(text: String, lineStart: Int, level: Int): String |
| 483 | MarkdownFormatter.kt | `applyHorizontalRule` | fun applyHorizontalRule(text: String, cursorPos: Int): String |
| 484 | MarkdownFormatter.kt | `applyInlineCode` | fun applyInlineCode(text: String, selection: TextSelection): String |
| 485 | MarkdownFormatter.kt | `applyItalic` | fun applyItalic(text: String, selection: TextSelection): String |
| 486 | MarkdownFormatter.kt | `applyLink` | fun applyLink(text: String, selection: TextSelection, url: String): String |
| 487 | MarkdownFormatter.kt | `applyNumberedList` | fun applyNumberedList(text: String, lineStart: Int): String |
| 488 | MarkdownFormatter.kt | `applyStrikethrough` | fun applyStrikethrough(text: String, selection: TextSelection): String |
| 489 | MarkdownFormatter.kt | `wrapSelection` | private fun wrapSelection( |
| 490 | PgpManager.kt | `compressData` | private fun compressData(data: ByteArray): ByteArray |
| 491 | PgpManager.kt | `decrypt` | fun decrypt(ciphertext: String, privateKey: String, passphrase: String = ""): String |
| 492 | PgpManager.kt | `encrypt` | fun encrypt(plaintext: String, recipientPublicKeys: List<String>): String |
| 493 | PgpManager.kt | `extractEncryptionKey` | private fun extractEncryptionKey(armoredPublicKey: String): PGPPublicKey? |
| 494 | PgpManager.kt | `extractLiteralData` | private fun extractLiteralData(factory: PGPObjectFactory): ByteArray |
| 495 | PgpManager.kt | `parseEncryptedDataList` | private fun parseEncryptedDataList(armoredCiphertext: String): PGPEncryptedDataList |
| 496 | PgpManager.kt | `parseSecretKeyRingCollection` | private fun parseSecretKeyRingCollection(armoredPrivateKey: String): PGPSecretKeyRingCollection |
| 497 | SmartLinkDetector.kt | `detect` | fun detect(bodyText: String, maxBadges: Int = 3): List<SmartLink> |

## domain/filter/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 498 | FilterEngine.kt | `applyFilters` | fun applyFilters( |
| 499 | FilterEngine.kt | `isPastDue` | private fun isPastDue(chit: ChitEntity, now: Instant): Boolean |
| 500 | FilterEngine.kt | `isSnoozed` | private fun isSnoozed(chit: ChitEntity, now: Instant): Boolean |
| 501 | FilterEngine.kt | `passesAllFilters` | private fun passesAllFilters( |
| 502 | FilterEngine.kt | `passesProjectFilter` | private fun passesProjectFilter( |

## domain/recurrence/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 503 | RecurrenceEngine.kt | `advanceDate` | private fun advanceDate( |
| 504 | RecurrenceEngine.kt | `expand` | fun expand( |
| 505 | RecurrenceEngine.kt | `formatRule` | fun formatRule(rule: RecurrenceRule, isHabit: Boolean = false): String |
| 506 | RecurrenceEngine.kt | `parseDate` | private fun parseDate(dateStr: String): LocalDate? |

## domain/search/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 507 | BooleanSearchEvaluator.kt | `evaluate` | private fun evaluate(node: SearchNode, text: String): Boolean |
| 508 | BooleanSearchEvaluator.kt | `extractSearchableText` | fun extractSearchableText(chit: ChitEntity): String |
| 509 | BooleanSearchEvaluator.kt | `matches` | fun matches(chit: ChitEntity, node: SearchNode): Boolean |
| 510 | BooleanSearchParser.kt | `parse` | fun parse(query: String): SearchNode? |
| 511 | BooleanSearchParser.kt | `parseAnd` | private fun parseAnd(): SearchNode |
| 512 | BooleanSearchParser.kt | `parseAtom` | private fun parseAtom(): SearchNode |
| 513 | BooleanSearchParser.kt | `parseNot` | private fun parseNot(): SearchNode |
| 514 | BooleanSearchParser.kt | `parseOr` | private fun parseOr(): SearchNode |
| 515 | BooleanSearchParser.kt | `tokenize` | private fun tokenize(input: String): List<String> |

## domain/sort/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 516 | SortEngine.kt | `buildComparator` | private fun buildComparator( |
| 517 | SortEngine.kt | `compareByField` | private fun compareByField(a: ChitEntity, b: ChitEntity, field: SortField): Int |
| 518 | SortEngine.kt | `compareByOrdinal` | private fun compareByOrdinal( |
| 519 | SortEngine.kt | `compareNullableStrings` | private fun compareNullableStrings(a: String?, b: String?): Int |
| 520 | SortEngine.kt | `sort` | fun sort( |

## domain/tags/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 521 | TagTreeParser.kt | `flattenTree` | fun flattenTree(tree: List<TagNode>): List<TagNode> |
| 522 | TagTreeParser.kt | `getLeafTags` | fun getLeafTags(tree: List<TagNode>): List<TagNode> |
| 523 | TagTreeParser.kt | `inheritColors` | private fun inheritColors(nodes: List<TagNode>, parentColor: String?) |
| 524 | TagTreeParser.kt | `parseRawTags` | private fun parseRawTags(json: String): List<RawTag> |
| 525 | TagTreeParser.kt | `parseTagTree` | fun parseTagTree(tagsJson: String?): List<TagNode> |
| 526 | TagTreeParser.kt | `sortTree` | private fun sortTree(nodes: MutableList<TagNode>) |
| 527 | TagTreeParser.kt | `walk` | fun walk(nodes: List<TagNode>) |

## notification/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 528 | AlarmReceiver.kt | `getRequestCode` | private fun getRequestCode(chitId: String, alertIndex: Int): Int |
| 529 | AlarmReceiver.kt | `onReceive` | override fun onReceive(context: Context, intent: Intent) |
| 530 | AlarmSoundPlayer.kt | `isPlaying` | fun isPlaying(): Boolean |
| 531 | AlarmSoundPlayer.kt | `play` | fun play(context: Context) |
| 532 | AlarmSoundPlayer.kt | `playLooping` | fun playLooping(context: Context) |
| 533 | AlarmSoundPlayer.kt | `stop` | fun stop() |
| 534 | BootReceiver.kt | `notificationScheduler` | fun notificationScheduler(): NotificationScheduler |
| 535 | BootReceiver.kt | `onReceive` | override fun onReceive(context: Context, intent: Intent) |
| 536 | ExactAlarmPermissionHelper.kt | `createPermissionRequestIntent` | fun createPermissionRequestIntent(): Intent? |
| 537 | ExactAlarmPermissionHelper.kt | `hasPermission` | fun hasPermission(): Boolean |
| 538 | ExactAlarmPermissionHelper.kt | `logPermissionState` | fun logPermissionState() |
| 539 | NotificationChannelManager.kt | `createChannels` | fun createChannels() |
| 540 | NotificationScheduler.kt | `cancelAlarms` | suspend fun cancelAlarms(chitId: String) |
| 541 | NotificationScheduler.kt | `createAlarmIntent` | private fun createAlarmIntent( |
| 542 | NotificationScheduler.kt | `getRequestCode` | private fun getRequestCode(chitId: String, alertIndex: Int): Int |
| 543 | NotificationScheduler.kt | `hasExactAlarmPermission` | fun hasExactAlarmPermission(): Boolean |
| 544 | NotificationScheduler.kt | `parseAlerts` | private fun parseAlerts(chit: ChitEntity): List<ChitAlert> |
| 545 | NotificationScheduler.kt | `rescheduleAll` | suspend fun rescheduleAll() |
| 546 | NotificationScheduler.kt | `scheduleAlarms` | suspend fun scheduleAlarms(chit: ChitEntity) |
| 547 | NotificationScheduler.kt | `scheduleExactAlarm` | private fun scheduleExactAlarm(alert: ChitAlert) |
| 548 | TimerNotificationHelper.kt | `fireTimerCompleteNotification` | fun fireTimerCompleteNotification(alertId: String, timerName: String?) |

## ui/components/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 549 | ArrangeViewsDialog.kt | `ArrangeViewRow` | private fun ArrangeViewRow( |
| 550 | ArrangeViewsDialog.kt | `ArrangeViewsDialog` | fun ArrangeViewsDialog( |
| 551 | ArrangeViewsDialog.kt | `HiddenViewRow` | private fun HiddenViewRow( |
| 552 | ArrangeViewsDialog.kt | `OmniFixedRow` | private fun OmniFixedRow() |
| 553 | ArrangeViewsDialog.kt | `parseHiddenEntries` | internal fun parseHiddenEntries(viewOrder: String): List<ViewTabEntry> |
| 554 | ArrangeViewsDialog.kt | `parseViewOrder` | internal fun parseViewOrder(viewOrder: String): List<ViewTabEntry> |
| 555 | ArrangeViewsDialog.kt | `parseVisibleEntries` | internal fun parseVisibleEntries(viewOrder: String): List<ViewTabEntry> |
| 556 | ArrangeViewsDialog.kt | `serializeViewOrder` | internal fun serializeViewOrder(entries: List<ViewTabEntry>): String |
| 557 | CalculatorSheet.kt | `CalcDigitButton` | private fun CalcDigitButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) |
| 558 | CalculatorSheet.kt | `CalcOperatorButton` | private fun CalcOperatorButton( |
| 559 | CalculatorSheet.kt | `CalculatorDisplay` | private fun CalculatorDisplay(expression: String, result: String) |
| 560 | CalculatorSheet.kt | `CalculatorKeypad` | private fun CalculatorKeypad( |
| 561 | CalculatorSheet.kt | `CalculatorSheet` | fun CalculatorSheet( |
| 562 | CalculatorSheet.kt | `evaluateExpression` | internal fun evaluateExpression(expr: String): String |
| 563 | CalculatorSheet.kt | `parseExpression` | private fun parseExpression(tokens: List<String>): Double |
| 564 | CalculatorSheet.kt | `tokenize` | private fun tokenize(expr: String): List<String> |
| 565 | ChitActionMenu.kt | `ChitActionMenu` | fun ChitActionMenu( |
| 566 | ChitCardEnhancements.kt | `ArchiveSnoozeIndicators` | fun ArchiveSnoozeIndicators( |
| 567 | ChitCardEnhancements.kt | `ChecklistProgressBadge` | fun ChecklistProgressBadge( |
| 568 | ChitCardEnhancements.kt | `HealthIndicatorBadges` | fun HealthIndicatorBadges( |
| 569 | ChitCardEnhancements.kt | `LocationIndicator` | fun LocationIndicator( |
| 570 | ChitCardEnhancements.kt | `Modifier` | fun Modifier.chitColorBorder(color: String?): Modifier |
| 571 | ChitCardEnhancements.kt | `PeopleChipsRow` | fun PeopleChipsRow( |
| 572 | ChitCardEnhancements.kt | `PersonChip` | private fun PersonChip(name: String) |
| 573 | ChitCardEnhancements.kt | `RsvpIndicators` | fun RsvpIndicators( |
| 574 | ChitCardEnhancements.kt | `SharingIndicators` | fun SharingIndicators( |
| 575 | ChitCardEnhancements.kt | `TagChip` | private fun TagChip(tagName: String, configuredColor: String? = null) |
| 576 | ChitCardEnhancements.kt | `TagChipsRow` | fun TagChipsRow( |
| 577 | ChitCardEnhancements.kt | `WeatherIndicator` | fun WeatherIndicator( |
| 578 | ChitCardEnhancements.kt | `countChecklistItems` | private fun countChecklistItems(items: List<Map<String, Any>>): Pair<Int, Int> |
| 579 | ChitCardEnhancements.kt | `filterSnoozedItems` | fun filterSnoozedItems(items: List<ChitEntity>, hideSnoozed: Boolean = true): List<ChitEntity> |
| 580 | ChitCardEnhancements.kt | `isOverdue` | fun isOverdue(chit: ChitEntity): Boolean |
| 581 | ChitCardEnhancements.kt | `isPastEvent` | fun isPastEvent(chit: ChitEntity): Boolean |
| 582 | ChitCardEnhancements.kt | `parseChecklistProgress` | private fun parseChecklistProgress(json: String): Pair<Int, Int> |
| 583 | ChitCardEnhancements.kt | `parseHealthIndicators` | private fun parseHealthIndicators(json: String): List<Pair<String, String>> |
| 584 | ChitCardEnhancements.kt | `parseHexColor` | fun parseHexColor(hex: String?): Color? |
| 585 | ChitCardEnhancements.kt | `parseWeatherData` | private fun parseWeatherData(json: String): WeatherInfo? |
| 586 | ChitCardEnhancements.kt | `tagColor` | private fun tagColor(tagName: String): Color |
| 587 | ChitCardEnhancements.kt | `weatherCodeToEmoji` | private fun weatherCodeToEmoji(code: Int): String |
| 588 | ChitListScaffold.kt | `ChitListScaffold` | fun ChitListScaffold( |
| 589 | ChitPickerSheet.kt | `ChitPickerSheet` | fun ChitPickerSheet( |
| 590 | ClockModal.kt | `ClockModal` | fun ClockModal( |
| 591 | CollapsibleSection.kt | `CollapsibleSection` | fun CollapsibleSection( |
| 592 | CollapsibleZone.kt | `CollapsibleZone` | fun CollapsibleZone( |
| 593 | CollapsibleZone.kt | `PeopleSectionHeader` | fun PeopleSectionHeader( |
| 594 | ConflictBanner.kt | `ConflictBanner` | fun ConflictBanner( |
| 595 | CwocButton.kt | `CwocPrimaryButton` | fun CwocPrimaryButton( |
| 596 | CwocButton.kt | `CwocZoneButton` | fun CwocZoneButton( |
| 597 | CwocChitCardStyle.kt | `cardColors` | fun cardColors(): CardColors = CardDefaults.cardColors( |
| 598 | CwocChitCardStyle.kt | `cardColorsForChit` | fun cardColorsForChit(colorHex: String?): CardColors |
| 599 | CwocChitCardStyle.kt | `cardElevation` | fun cardElevation(): CardElevation = CardDefaults.cardElevation( |
| 600 | CwocChitCardStyle.kt | `contrastTextColor` | fun contrastTextColor(bgColor: Color): Color |
| 601 | CwocChitCardStyle.kt | `resolveChitBgColor` | fun resolveChitBgColor(colorHex: String?): Color |
| 602 | CwocPromptDialog.kt | `CwocPromptDialog` | fun CwocPromptDialog( |
| 603 | CwocTextField.kt | `cwocTextFieldColors` | fun cwocTextFieldColors(): TextFieldColors |
| 604 | DropdownWithCustom.kt | `DropdownWithCustom` | fun DropdownWithCustom( |
| 605 | DrumRollerTimePicker.kt | `AmPmInput` | private fun AmPmInput( |
| 606 | DrumRollerTimePicker.kt | `DrumColumn` | private fun DrumColumn( |
| 607 | DrumRollerTimePicker.kt | `DrumRollerButton` | private fun DrumRollerButton( |
| 608 | DrumRollerTimePicker.kt | `DrumRollerTimePicker` | fun DrumRollerTimePicker( |
| 609 | DrumRollerTimePicker.kt | `OverwriteInput` | private fun OverwriteInput( |
| 610 | DrumRollerTimePicker.kt | `confirmAndClose` | fun confirmAndClose() |
| 611 | DrumRollerTimePicker.kt | `rememberSnapFlingBehavior` | private fun rememberSnapFlingBehavior( |
| 612 | DrumRollerTimePicker.kt | `syncInputsFromDrums` | fun syncInputsFromDrums() |
| 613 | DrumRollerTimePicker.kt | `validateHourInput` | private fun validateHourInput(text: String, is24Hour: Boolean): InputValidationResult? |
| 614 | DrumRollerTimePicker.kt | `validateMinuteInput` | private fun validateMinuteInput(text: String): InputValidationResult? |
| 615 | FlatpickrCalendarPicker.kt | `CalendarHeader` | private fun CalendarHeader( |
| 616 | FlatpickrCalendarPicker.kt | `DayCell` | private fun DayCell( |
| 617 | FlatpickrCalendarPicker.kt | `DayGrid` | private fun DayGrid( |
| 618 | FlatpickrCalendarPicker.kt | `DayOfWeekHeader` | private fun DayOfWeekHeader() |
| 619 | FlatpickrCalendarPicker.kt | `FlatpickrCalendarPicker` | fun FlatpickrCalendarPicker( |
| 620 | FlatpickrCalendarPicker.kt | `buildDayGrid` | private fun buildDayGrid(yearMonth: YearMonth): List<LocalDate> |
| 621 | FlatpickrCalendarPicker.kt | `formatYMDDate` | fun formatYMDDate(date: LocalDate): String |
| 622 | FlatpickrCalendarPicker.kt | `parseYMDDate` | fun parseYMDDate(dateStr: String?): LocalDate? |
| 623 | ImageViewDialog.kt | `ImageViewDialog` | fun ImageViewDialog( |
| 624 | MarkdownRenderer.kt | `MarkdownRenderer` | fun MarkdownRenderer( |
| 625 | MarkdownRenderer.kt | `handleLinkClick` | private fun handleLinkClick( |
| 626 | MarkdownRenderer.kt | `headingStyle` | private fun headingStyle(level: Int): TextStyle |
| 627 | MarkdownRenderer.kt | `parseInlineFormatting` | private fun parseInlineFormatting(text: String): AnnotatedString |
| 628 | MarkdownRenderer.kt | `parseMarkdownBlocks` | private fun parseMarkdownBlocks(markdown: String): List<MarkdownBlock> |
| 629 | MiniChart.kt | `MiniBarChart` | fun MiniBarChart( |
| 630 | MiniChart.kt | `MiniLineChart` | fun MiniLineChart( |
| 631 | MultiValueSection.kt | `MultiValueSection` | fun MultiValueSection( |
| 632 | MultiValueSection.kt | `firstMultiValue` | fun firstMultiValue(json: String?): String? |
| 633 | MultiValueSection.kt | `parseMultiValueJson` | fun parseMultiValueJson(json: String?): List<MultiValueEntry> |
| 634 | MultiValueSection.kt | `serializeMultiValue` | fun serializeMultiValue(entries: List<MultiValueEntry>): String? |
| 635 | ProfileMenu.kt | `NotificationCard` | private fun NotificationCard( |
| 636 | ProfileMenu.kt | `ProfileMenu` | fun ProfileMenu( |
| 637 | PullToRefreshWrapper.kt | `PullToRefreshListScreen` | fun PullToRefreshListScreen( |
| 638 | QrCodeDialog.kt | `ChitQrCodeDialog` | fun ChitQrCodeDialog( |
| 639 | QrCodeDialog.kt | `ContactFormQrCodeDialog` | fun ContactFormQrCodeDialog( |
| 640 | QrCodeDialog.kt | `ContactQrCodeDialog` | fun ContactQrCodeDialog( |
| 641 | QrCodeDialog.kt | `addMulti` | fun addMulti(prop: String, json: String) |
| 642 | QrCodeDialog.kt | `buildVCardFromForm` | private fun buildVCardFromForm( |
| 643 | QrCodeDialog.kt | `generateQrBitmap` | internal fun generateQrBitmap(data: String, size: Int): Bitmap? |
| 644 | QuickEditSheet.kt | `QuickEditSheet` | fun QuickEditSheet( |
| 645 | RecurringEditDialog.kt | `RecurringEditDialog` | fun RecurringEditDialog( |
| 646 | ReferenceDialog.kt | `ReferenceDialog` | fun ReferenceDialog( |
| 647 | ReferenceDialog.kt | `ReferenceItem` | private fun ReferenceItem(gesture: String, action: String) |
| 648 | ReferenceDialog.kt | `ReferenceSection` | private fun ReferenceSection(title: String, content: @Composable () -> Unit) |
| 649 | ReleaseNotesDialog.kt | `ReleaseNotesDialog` | fun ReleaseNotesDialog( |
| 650 | ReleaseNotesDialog.kt | `formatReleaseNoteDate` | private fun formatReleaseNoteDate(dateStr: String): String |
| 651 | SidebarCompactButton.kt | `SidebarCompactButton` | fun SidebarCompactButton( |
| 652 | SnoozePickerDialog.kt | `SnoozePickerDialog` | fun SnoozePickerDialog( |
| 653 | SnoozePickerDialog.kt | `buildCustomSnoozeTime` | private fun buildCustomSnoozeTime( |
| 654 | SnoozePickerDialog.kt | `calculateNextMonday9am` | private fun calculateNextMonday9am(): Instant |
| 655 | SnoozePickerDialog.kt | `calculateTomorrow9am` | private fun calculateTomorrow9am(): Instant |
| 656 | SnoozePickerDialog.kt | `formatInstantToIso` | private fun formatInstantToIso(instant: Instant): String |
| 657 | SwipeableChitCard.kt | `SwipeableChitCard` | fun SwipeableChitCard( |
| 658 | SyncStateIndicator.kt | `SyncStateIndicator` | fun SyncStateIndicator( |
| 659 | TagCreateDialog.kt | `TagCreateDialog` | fun TagCreateDialog( |
| 660 | TagCreateDialog.kt | `parseTagColorHex` | private fun parseTagColorHex(hex: String): Color |
| 661 | TagCreateDialog.kt | `walk` | fun walk(nodes: List<TagNode>, depth: Int) |
| 662 | TimezonePickerModal.kt | `TimezonePickerModal` | fun TimezonePickerModal( |
| 663 | TimezonePickerModal.kt | `ZoneButton` | fun ZoneButton( |
| 664 | TimezonePickerModal.kt | `detectTimezoneFromCoords` | internal fun detectTimezoneFromCoords(lat: Double, lon: Double, countryCode: String?): String? |
| 665 | TimezonePickerModal.kt | `findExactTimezone` | private fun findExactTimezone(input: String): String? |
| 666 | TimezonePickerModal.kt | `formatCommonTzDisplay` | private fun formatCommonTzDisplay(entry: CommonTzEntry): String |
| 667 | TimezonePickerModal.kt | `getTimezoneAbbreviation` | private fun getTimezoneAbbreviation(tzId: String): String |
| 668 | TimezonePickerModal.kt | `isValidTimezone` | private fun isValidTimezone(tz: String): Boolean |
| 669 | TimezoneSuggestionPrompt.kt | `TimezoneSuggestionPrompt` | fun TimezoneSuggestionPrompt( |
| 670 | UndoToast.kt | `UndoToast` | fun UndoToast( |
| 671 | WeatherModal.kt | `WeatherModal` | fun WeatherModal( |
| 672 | WeatherModal.kt | `fetchWeather` | fun fetchWeather(address: String) |
| 673 | WeatherModal.kt | `weatherCodeToDescription` | private fun weatherCodeToDescription(code: Int): String = when (code) |
| 674 | WeatherModal.kt | `weatherCodeToIcon` | private fun weatherCodeToIcon(code: Int): String = when (code) |

## ui/components/swipe/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 675 | SwipeActionState.kt | `applyArchive` | fun applyArchive(chit: ChitEntity): Pair<SwipeActionResult, ChitEntity> |
| 676 | SwipeActionState.kt | `applySnooze` | fun applySnooze(chit: ChitEntity, snoozeUntil: String): Pair<SwipeActionResult, ChitEntity> |
| 677 | SwipeActionState.kt | `undoSwipeAction` | fun undoSwipeAction(chit: ChitEntity, result: SwipeActionResult): ChitEntity |
| 678 | SwipeToAction.kt | `SwipeBackground` | private fun SwipeBackground(dismissState: SwipeToDismissBoxState) |
| 679 | SwipeToAction.kt | `SwipeToAction` | fun SwipeToAction( |

## ui/navigation/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 680 | CCaptnTabRow.kt | `CCaptnTabRow` | fun CCaptnTabRow( |
| 681 | CCaptnTabRow.kt | `getOrderedVisibleTabs` | fun getOrderedVisibleTabs(viewOrder: String?): List<CCaptnTab> |
| 682 | CwocNavGraph.kt | `CwocNavGraph` | fun CwocNavGraph( |
| 683 | FilterPanel.kt | `FilterPanel` | fun FilterPanel( |
| 684 | FilterPanel.kt | `FilterToggleRow` | private fun FilterToggleRow( |
| 685 | Screen.kt | `createProfileRoute` | fun createProfileRoute(userId: String) = "contact-editor/profile?userId=$userId" |
| 686 | Screen.kt | `createRoute` | fun createRoute(tab: String? = null, section: String? = null): String |
| 687 | Screen.kt | `createRouteWithPrefill` | fun createRouteWithPrefill(start: String, end: String) = "editor/new?start=$start&end=$end" |
| 688 | SidebarContent.kt | `EmailAccountPills` | private fun EmailAccountPills(accounts: List<String>, selectedAccounts: List<String>, onAccountToggle: (String) -> Unit) |
| 689 | SidebarContent.kt | `HabitsSuccessWindowDropdown` | private fun HabitsSuccessWindowDropdown(currentWindow: Int, onWindowChange: (Int) -> Unit) |
| 690 | SidebarContent.kt | `SidebarContent` | fun SidebarContent( |
| 691 | SidebarContent.kt | `TimePeriodDropdown` | private fun TimePeriodDropdown(currentPeriod: String, onPeriodChange: (String) -> Unit) |
| 692 | SidebarContent.kt | `ViewModeButton` | private fun ViewModeButton( |
| 693 | SortPanel.kt | `SortField` | private fun SortField.displayLabel(): String = when (this) |
| 694 | SortPanel.kt | `SortPanel` | fun SortPanel( |
| 695 | ViewsPanel.kt | `RightEdgeSwipeDetector` | fun RightEdgeSwipeDetector( |
| 696 | ViewsPanel.kt | `ViewsPanel` | fun ViewsPanel( |
| 697 | ViewsPanel.kt | `ViewsPanelItem` | private fun ViewsPanelItem( |

## ui/screens/adminchits/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 698 | AdminChitsScreen.kt | `AdminChitCard` | private fun AdminChitCard( |
| 699 | AdminChitsScreen.kt | `AdminChitsScreen` | fun AdminChitsScreen( |
| 700 | AdminChitsScreen.kt | `BulkActionBar` | private fun BulkActionBar( |
| 701 | AdminChitsScreen.kt | `EmptyState` | private fun EmptyState() |
| 702 | AdminChitsScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| 703 | AdminChitsScreen.kt | `FilterBar` | private fun FilterBar( |
| 704 | AdminChitsScreen.kt | `LoadingState` | private fun LoadingState() |
| 705 | AdminChitsScreen.kt | `PaginationControls` | private fun PaginationControls( |
| 706 | AdminChitsScreen.kt | `StatusBadge` | private fun StatusBadge(status: String) |
| 707 | AdminChitsScreen.kt | `TagChip` | private fun TagChip(tag: String) |
| 708 | AdminChitsScreen.kt | `formatDate` | private fun formatDate(dateStr: String): String |
| 709 | AdminChitsScreen.kt | `formatStatusLabel` | private fun formatStatusLabel(status: String): String |
| 710 | AdminChitsViewModel.kt | `bulkChangeOwner` | fun bulkChangeOwner(newOwner: String) |
| 711 | AdminChitsViewModel.kt | `bulkChangePriority` | fun bulkChangePriority(newPriority: String) |
| 712 | AdminChitsViewModel.kt | `bulkChangeStatus` | fun bulkChangeStatus(newStatus: String) |
| 713 | AdminChitsViewModel.kt | `bulkDelete` | fun bulkDelete() |
| 714 | AdminChitsViewModel.kt | `bulkUndelete` | fun bulkUndelete() |
| 715 | AdminChitsViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| 716 | AdminChitsViewModel.kt | `clearSelection` | fun clearSelection() |
| 717 | AdminChitsViewModel.kt | `enterSelectionMode` | fun enterSelectionMode(chitId: String) |
| 718 | AdminChitsViewModel.kt | `loadChits` | fun loadChits() |
| 719 | AdminChitsViewModel.kt | `nextPage` | fun nextPage() |
| 720 | AdminChitsViewModel.kt | `previousPage` | fun previousPage() |
| 721 | AdminChitsViewModel.kt | `setOwnerFilter` | fun setOwnerFilter(owner: String) |
| 722 | AdminChitsViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| 723 | AdminChitsViewModel.kt | `setShowDeleted` | fun setShowDeleted(show: Boolean) |
| 724 | AdminChitsViewModel.kt | `setStatusFilter` | fun setStatusFilter(status: String) |
| 725 | AdminChitsViewModel.kt | `toggleSelection` | fun toggleSelection(chitId: String) |

## ui/screens/alerts/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 726 | AlarmFiredActivity.kt | `AlarmFiredScreen` | private fun AlarmFiredScreen( |
| 727 | AlarmFiredActivity.kt | `getCurrentTimeFormatted` | private fun getCurrentTimeFormatted(): String |
| 728 | AlarmFiredActivity.kt | `onCreate` | override fun onCreate(savedInstanceState: Bundle?) |
| 729 | AlarmFiredActivity.kt | `onDestroy` | override fun onDestroy() |
| 730 | AlarmFiredActivity.kt | `scheduleSnooze` | private fun scheduleSnooze(chitId: String, title: String, minutes: Int) |
| 731 | AlarmFiredActivity.kt | `startAlarmSound` | private fun startAlarmSound() |
| 732 | AlarmFiredActivity.kt | `startVibration` | private fun startVibration() |
| 733 | AlarmFiredActivity.kt | `stopAlarm` | private fun stopAlarm() |
| 734 | AlertsScreen.kt | `AlertsScreen` | fun AlertsScreen( |
| 735 | AlertsScreen.kt | `ModeToggleRow` | private fun ModeToggleRow( |
| 736 | AlertsViewModel.kt | `acceptNotification` | fun acceptNotification(id: String) |
| 737 | AlertsViewModel.kt | `archiveReminder` | fun archiveReminder(chitId: String) |
| 738 | AlertsViewModel.kt | `cancelComplete` | fun cancelComplete(chitId: String) |
| 739 | AlertsViewModel.kt | `clearAddressed` | fun clearAddressed() |
| 740 | AlertsViewModel.kt | `clearNotificationError` | fun clearNotificationError() |
| 741 | AlertsViewModel.kt | `completeReminder` | fun completeReminder(chitId: String) |
| 742 | AlertsViewModel.kt | `createAlarm` | fun createAlarm() |
| 743 | AlertsViewModel.kt | `createStopwatch` | fun createStopwatch() |
| 744 | AlertsViewModel.kt | `createTimer` | fun createTimer() |
| 745 | AlertsViewModel.kt | `declineNotification` | fun declineNotification(id: String) |
| 746 | AlertsViewModel.kt | `deleteNotification` | fun deleteNotification(id: String) |
| 747 | AlertsViewModel.kt | `deleteReminder` | fun deleteReminder(chitId: String) |
| 748 | AlertsViewModel.kt | `deleteStandaloneAlert` | fun deleteStandaloneAlert(id: String) |
| 749 | AlertsViewModel.kt | `dismissNotification` | fun dismissNotification(id: String) |
| 750 | AlertsViewModel.kt | `fetchNotifications` | private fun fetchNotifications() |
| 751 | AlertsViewModel.kt | `getAddressedNotifications` | fun getAddressedNotifications(): List<NotificationDto> |
| 752 | AlertsViewModel.kt | `getOrCreateStopwatchRuntime` | fun getOrCreateStopwatchRuntime(alertId: String): StopwatchRuntime |
| 753 | AlertsViewModel.kt | `getOrCreateTimerRuntime` | fun getOrCreateTimerRuntime(alertId: String): TimerRuntime |
| 754 | AlertsViewModel.kt | `getPastReminders` | fun getPastReminders(): List<ChitEntity> |
| 755 | AlertsViewModel.kt | `getTimerName` | private fun getTimerName(alertId: String): String? |
| 756 | AlertsViewModel.kt | `getUnreadNotifications` | fun getUnreadNotifications(): List<NotificationDto> |
| 757 | AlertsViewModel.kt | `getUpcomingReminders` | fun getUpcomingReminders(): List<ChitEntity> |
| 758 | AlertsViewModel.kt | `loadDataForMode` | private fun loadDataForMode(mode: String) |
| 759 | AlertsViewModel.kt | `loadPersistedMode` | private fun loadPersistedMode(): String |
| 760 | AlertsViewModel.kt | `observeTimerForNotification` | private fun observeTimerForNotification(alertId: String, runtime: TimerRuntime) |
| 761 | AlertsViewModel.kt | `refresh` | fun refresh() |
| 762 | AlertsViewModel.kt | `removeStopwatchRuntime` | fun removeStopwatchRuntime(alertId: String) |
| 763 | AlertsViewModel.kt | `removeTimerRuntime` | fun removeTimerRuntime(alertId: String) |
| 764 | AlertsViewModel.kt | `setMode` | fun setMode(mode: String) |
| 765 | AlertsViewModel.kt | `snoozeNotification` | fun snoozeNotification(id: String, minutes: Int) |
| 766 | AlertsViewModel.kt | `startChitsCollection` | private fun startChitsCollection() |
| 767 | AlertsViewModel.kt | `startIndependentCollection` | private fun startIndependentCollection() |
| 768 | AlertsViewModel.kt | `startRemindersCollection` | private fun startRemindersCollection() |
| 769 | AlertsViewModel.kt | `toggleReminderPin` | fun toggleReminderPin(chitId: String) |
| 770 | AlertsViewModel.kt | `updateNotificationStatusLocally` | private fun updateNotificationStatusLocally(id: String, newStatus: String) |
| 771 | AlertsViewModel.kt | `updateStandaloneAlert` | fun updateStandaloneAlert(id: String, body: Map<String, Any?>) |
| 772 | ChitAlertsListView.kt | `ChitAlertCard` | private fun ChitAlertCard( |
| 773 | ChitAlertsListView.kt | `ChitAlertsListView` | fun ChitAlertsListView( |
| 774 | ChitAlertsListView.kt | `buildAlertSummaryParts` | private fun buildAlertSummaryParts(counts: AlertCounts): List<String> |
| 775 | ChitAlertsListView.kt | `parseAlertCounts` | private fun parseAlertCounts( |
| 776 | IndependentAlarmCard.kt | `IndependentAlarmCard` | fun IndependentAlarmCard( |
| 777 | IndependentAlarmCard.kt | `formatAlarmTime` | private fun formatAlarmTime(time: String, timeFormat: String): String |
| 778 | IndependentAlarmCard.kt | `saveAlarm` | private fun saveAlarm( |
| 779 | IndependentAlertsBoard.kt | `EmptyStateText` | private fun EmptyStateText(message: String) |
| 780 | IndependentAlertsBoard.kt | `IndependentAlertsBoard` | fun IndependentAlertsBoard( |
| 781 | IndependentAlertsBoard.kt | `SectionHeader` | private fun SectionHeader( |
| 782 | IndependentStopwatchCard.kt | `IndependentStopwatchCard` | fun IndependentStopwatchCard( |
| 783 | IndependentTimerCard.kt | `DurationInputRow` | private fun DurationInputRow( |
| 784 | IndependentTimerCard.kt | `IndependentTimerCard` | fun IndependentTimerCard( |
| 785 | IndependentTimerCard.kt | `TimerDoneBar` | private fun TimerDoneBar() |
| 786 | IndependentTimerCard.kt | `TimerProgressBar` | private fun TimerProgressBar( |
| 787 | IndependentTimerCard.kt | `formatRemainingTime` | private fun formatRemainingTime(remainingMs: Long): String |
| 788 | IndependentTimerCard.kt | `notifyDurationChange` | private fun notifyDurationChange( |
| 789 | NotificationsView.kt | `AcceptDeclinePill` | private fun AcceptDeclinePill( |
| 790 | NotificationsView.kt | `AddressedSectionHeader` | private fun AddressedSectionHeader(count: Int, onClearAddressed: () -> Unit) |
| 791 | NotificationsView.kt | `NotificationCard` | private fun NotificationCard( |
| 792 | NotificationsView.kt | `NotificationsView` | fun NotificationsView( |
| 793 | NotificationsView.kt | `SectionHeaderRow` | private fun SectionHeaderRow(title: String, count: Int) |
| 794 | NotificationsView.kt | `StatusBadge` | private fun StatusBadge(status: String) |
| 795 | NotificationsView.kt | `formatNotificationDate` | private fun formatNotificationDate(dateStr: String, timeFormat: String): String |
| 796 | RemindersView.kt | `ReminderCard` | private fun ReminderCard( |
| 797 | RemindersView.kt | `ReminderSectionHeader` | private fun ReminderSectionHeader(title: String, count: Int) |
| 798 | RemindersView.kt | `RemindersView` | fun RemindersView( |
| 799 | RemindersView.kt | `formatPointInTime` | private fun formatPointInTime(pointInTime: String?, timeFormat: String): String |

## ui/screens/attachments/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 800 | AttachmentsScreen.kt | `AttachmentCard` | private fun AttachmentCard( |
| 801 | AttachmentsScreen.kt | `AttachmentsScreen` | fun AttachmentsScreen( |
| 802 | AttachmentsScreen.kt | `EmptyState` | private fun EmptyState() |
| 803 | AttachmentsScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| 804 | AttachmentsScreen.kt | `FilterBar` | private fun FilterBar( |
| 805 | AttachmentsScreen.kt | `LoadingState` | private fun LoadingState() |
| 806 | AttachmentsScreen.kt | `PreviewDialog` | private fun PreviewDialog( |
| 807 | AttachmentsScreen.kt | `formatDate` | private fun formatDate(dateStr: String): String |
| 808 | AttachmentsScreen.kt | `formatFileSize` | private fun formatFileSize(bytes: Long): String |
| 809 | AttachmentsScreen.kt | `getTypeIcon` | private fun getTypeIcon(contentType: String): ImageVector |
| 810 | AttachmentsViewModel.kt | `bulkDelete` | fun bulkDelete() |
| 811 | AttachmentsViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| 812 | AttachmentsViewModel.kt | `enterMultiSelectMode` | fun enterMultiSelectMode(attachmentId: String) |
| 813 | AttachmentsViewModel.kt | `exitMultiSelectMode` | fun exitMultiSelectMode() |
| 814 | AttachmentsViewModel.kt | `getDownloadUrl` | fun getDownloadUrl(attachment: AttachmentItem): String |
| 815 | AttachmentsViewModel.kt | `getFilteredAttachments` | fun getFilteredAttachments(): List<AttachmentItem> |
| 816 | AttachmentsViewModel.kt | `getServerUrl` | fun getServerUrl(): String |
| 817 | AttachmentsViewModel.kt | `loadAttachments` | fun loadAttachments() |
| 818 | AttachmentsViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| 819 | AttachmentsViewModel.kt | `setSizeMax` | fun setSizeMax(mb: Float?) |
| 820 | AttachmentsViewModel.kt | `setSizeMin` | fun setSizeMin(mb: Float?) |
| 821 | AttachmentsViewModel.kt | `setSortOrder` | fun setSortOrder(sort: AttachmentSort) |
| 822 | AttachmentsViewModel.kt | `setTypeFilter` | fun setTypeFilter(filter: AttachmentTypeFilter) |
| 823 | AttachmentsViewModel.kt | `toggleSelection` | fun toggleSelection(attachmentId: String) |

## ui/screens/auditlog/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 824 | AuditLogScreen.kt | `ActionBadge` | private fun ActionBadge(action: String) |
| 825 | AuditLogScreen.kt | `ActorFilterDropdown` | private fun ActorFilterDropdown( |
| 826 | AuditLogScreen.kt | `AuditDatePickerDialog` | private fun AuditDatePickerDialog( |
| 827 | AuditLogScreen.kt | `AuditEntryCard` | private fun AuditEntryCard( |
| 828 | AuditLogScreen.kt | `AuditLogScreen` | fun AuditLogScreen( |
| 829 | AuditLogScreen.kt | `ChangeRow` | private fun ChangeRow(change: AuditChange) |
| 830 | AuditLogScreen.kt | `DateRangeRow` | private fun DateRangeRow( |
| 831 | AuditLogScreen.kt | `EmptyState` | private fun EmptyState() |
| 832 | AuditLogScreen.kt | `EntityTypeFilterRow` | private fun EntityTypeFilterRow( |
| 833 | AuditLogScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| 834 | AuditLogScreen.kt | `FilterControlsRow` | private fun FilterControlsRow( |
| 835 | AuditLogScreen.kt | `LoadingState` | private fun LoadingState() |
| 836 | AuditLogScreen.kt | `PageSizeDropdown` | private fun PageSizeDropdown( |
| 837 | AuditLogScreen.kt | `PaginationControls` | private fun PaginationControls( |
| 838 | AuditLogScreen.kt | `PruneAuditDialog` | private fun PruneAuditDialog( |
| 839 | AuditLogScreen.kt | `SortDropdown` | private fun SortDropdown( |
| 840 | AuditLogScreen.kt | `buildChangeText` | private fun buildChangeText(change: AuditChange): String |
| 841 | AuditLogScreen.kt | `formatDateLabel` | private fun formatDateLabel(dateStr: String): String |
| 842 | AuditLogScreen.kt | `formatTimestamp` | private fun formatTimestamp(timestamp: String): String |
| 843 | AuditLogViewModel.kt | `exportCsv` | fun exportCsv() |
| 844 | AuditLogViewModel.kt | `loadEntries` | fun loadEntries() |
| 845 | AuditLogViewModel.kt | `nextPage` | fun nextPage() |
| 846 | AuditLogViewModel.kt | `previousPage` | fun previousPage() |
| 847 | AuditLogViewModel.kt | `pruneEntries` | fun pruneEntries(olderThanDays: Int) |
| 848 | AuditLogViewModel.kt | `revertEntry` | fun revertEntry(entryId: String) |
| 849 | AuditLogViewModel.kt | `setActorFilter` | fun setActorFilter(actor: String) |
| 850 | AuditLogViewModel.kt | `setDateRange` | fun setDateRange(since: String?, until: String?) |
| 851 | AuditLogViewModel.kt | `setEntityTypeFilter` | fun setEntityTypeFilter(type: String) |
| 852 | AuditLogViewModel.kt | `setPageSize` | fun setPageSize(size: Int) |
| 853 | AuditLogViewModel.kt | `setSort` | fun setSort(sortBy: String, sortOrder: String) |

## ui/screens/calendar/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 854 | CalendarItineraryView.kt | `ItineraryDayHeader` | private fun ItineraryDayHeader(date: LocalDate) |
| 855 | CalendarItineraryView.kt | `ItineraryEmptyState` | private fun ItineraryEmptyState() |
| 856 | CalendarItineraryView.kt | `ItineraryEventCard` | private fun ItineraryEventCard( |
| 857 | CalendarItineraryView.kt | `ItineraryView` | fun ItineraryView( |
| 858 | CalendarItineraryView.kt | `buildItineraryTimeText` | private fun buildItineraryTimeText(event: ChitEntity): String |
| 859 | CalendarItineraryView.kt | `groupEventsByDay` | private fun groupEventsByDay(events: List<ChitEntity>): List<Pair<LocalDate, List<ChitEntity>>> |
| 860 | CalendarItineraryView.kt | `parseItineraryColor` | private fun parseItineraryColor(colorString: String): Color |
| 861 | CalendarMonthView.kt | `MonthDayCellView` | private fun MonthDayCellView( |
| 862 | CalendarMonthView.kt | `MonthView` | fun MonthView( |
| 863 | CalendarMonthView.kt | `buildDayHeaders` | private fun buildDayHeaders(startDayOfWeek: DayOfWeek): List<String> |
| 864 | CalendarMonthView.kt | `buildMonthGrid` | private fun buildMonthGrid( |
| 865 | CalendarMonthView.kt | `groupEventsByDate` | private fun groupEventsByDate(events: List<ChitEntity>): Map<LocalDate, List<ChitEntity>> |
| 866 | CalendarMonthView.kt | `parseEventColor` | private fun parseEventColor(colorString: String): Color |
| 867 | CalendarMonthView.kt | `parseWeekStartDay` | private fun parseWeekStartDay(weekStartDay: String): DayOfWeek |
| 868 | CalendarScreen.kt | `CalendarScreen` | fun CalendarScreen( |
| 869 | CalendarScreen.kt | `EventCard` | private fun EventCard(event: ChitEntity, onTap: () -> Unit |
| 870 | CalendarScreen.kt | `EventList` | private fun EventList( |
| 871 | CalendarScreen.kt | `buildTimeText` | private fun buildTimeText(event: ChitEntity): String |
| 872 | CalendarScreen.kt | `parseColor` | private fun parseColor(colorString: String): Color |
| 873 | CalendarTimeGrid.kt | `AllDayEventChip` | private fun AllDayEventChip( |
| 874 | CalendarTimeGrid.kt | `DayEventCard` | private fun DayEventCard( |
| 875 | CalendarTimeGrid.kt | `DayTimeGrid` | fun DayTimeGrid( |
| 876 | CalendarTimeGrid.kt | `WeekEventChip` | private fun WeekEventChip( |
| 877 | CalendarTimeGrid.kt | `WeekTimeGrid` | fun WeekTimeGrid( |
| 878 | CalendarTimeGrid.kt | `buildEventTimeLabel` | private fun buildEventTimeLabel(info: CalendarDateInfo, timeFormat: String): String |
| 879 | CalendarTimeGrid.kt | `calculateOverlapLayout` | private fun calculateOverlapLayout( |
| 880 | CalendarTimeGrid.kt | `eventMatchesDay` | private fun eventMatchesDay(info: CalendarDateInfo, day: LocalDate): Boolean |
| 881 | CalendarTimeGrid.kt | `fmtTime` | private fun fmtTime(dt: LocalDateTime, timeFormat: String): String |
| 882 | CalendarTimeGrid.kt | `formatHourLabel` | private fun formatHourLabel(hour: Int, timeFormat: String): String |
| 883 | CalendarTimeGrid.kt | `getCalendarDateInfoForEvent` | private fun getCalendarDateInfoForEvent(event: ChitEntity): CalendarDateInfo |
| 884 | CalendarTimeGrid.kt | `isDeclinedByUser` | private fun isDeclinedByUser(event: ChitEntity, currentUsername: String?): Boolean |
| 885 | CalendarTimeGrid.kt | `parseDateTime` | private fun parseDateTime(dateStr: String?): LocalDateTime? |
| 886 | CalendarTimeGrid.kt | `persistDragMove` | private fun persistDragMove( |
| 887 | CalendarTimeGrid.kt | `snapToGrid` | private fun snapToGrid(minutes: Int, snapMinutes: Int): Int |
| 888 | CalendarViewModel.kt | `getDateRange` | private fun getDateRange(date: LocalDate, mode: CalendarViewMode, xDayCount: Int): Pair<String, String> |
| 889 | CalendarViewModel.kt | `goToToday` | fun goToToday() |
| 890 | CalendarViewModel.kt | `loadEvents` | private fun loadEvents() |
| 891 | CalendarViewModel.kt | `nextPeriod` | fun nextPeriod() |
| 892 | CalendarViewModel.kt | `parseLocalDateTime` | private fun parseLocalDateTime(dateStr: String?): LocalDateTime? |
| 893 | CalendarViewModel.kt | `parseRecurrenceExceptions` | private fun parseRecurrenceExceptions(json: String?): List<RecurrenceException> |
| 894 | CalendarViewModel.kt | `parseRecurrenceRule` | private fun parseRecurrenceRule(json: String?): RecurrenceRule? |
| 895 | CalendarViewModel.kt | `persistViewMode` | private fun persistViewMode(mode: CalendarViewMode) |
| 896 | CalendarViewModel.kt | `previousPeriod` | fun previousPeriod() |
| 897 | CalendarViewModel.kt | `setDate` | fun setDate(date: LocalDate) |
| 898 | CalendarViewModel.kt | `setMonthMode` | fun setMonthMode(mode: String) |
| 899 | CalendarViewModel.kt | `setViewMode` | fun setViewMode(mode: CalendarViewMode) |
| 900 | CalendarViewModel.kt | `updateChitDateTimes` | fun updateChitDateTimes( |
| 901 | CalendarXDayView.kt | `DayColumn` | private fun DayColumn( |
| 902 | CalendarXDayView.kt | `DayHeader` | private fun DayHeader( |
| 903 | CalendarXDayView.kt | `XDayEventCard` | private fun XDayEventCard( |
| 904 | CalendarXDayView.kt | `XDayView` | fun XDayView( |
| 905 | CalendarXDayView.kt | `buildEventTimeText` | private fun buildEventTimeText(event: ChitEntity): String |
| 906 | CalendarXDayView.kt | `groupEventsByDate` | private fun groupEventsByDate( |
| 907 | CalendarXDayView.kt | `parseEventColor` | private fun parseEventColor(colorString: String): Color |
| 908 | CalendarXDayView.kt | `parseEventDate` | private fun parseEventDate(event: ChitEntity): LocalDate? |
| 909 | CalendarYearView.kt | `DayCell` | private fun DayCell( |
| 910 | CalendarYearView.kt | `MiniMonthGrid` | private fun MiniMonthGrid( |
| 911 | CalendarYearView.kt | `YearView` | fun YearView( |
| 912 | CalendarYearView.kt | `getOrderedDaysOfWeek` | private fun getOrderedDaysOfWeek(firstDayOfWeek: DayOfWeek): List<DayOfWeek> |
| 913 | CalendarYearView.kt | `getStartOffset` | private fun getStartOffset(firstDayOfMonth: DayOfWeek, firstDayOfWeek: DayOfWeek): Int |
| 914 | CalendarYearView.kt | `parseToLocalDate` | private fun parseToLocalDate(datetime: String): LocalDate? |
| 915 | CalendarYearView.kt | `parseWeekStartDay` | private fun parseWeekStartDay(weekStartDay: String): DayOfWeek |

## ui/screens/checklists/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 916 | ChecklistsScreen.kt | `ChecklistChitCard` | private fun ChecklistChitCard( |
| 917 | ChecklistsScreen.kt | `ChecklistItemRow` | private fun ChecklistItemRow( |
| 918 | ChecklistsScreen.kt | `ChecklistsScreen` | fun ChecklistsScreen( |
| 919 | ChecklistsScreen.kt | `EmptyChecklistsState` | private fun EmptyChecklistsState() |
| 920 | ChecklistsScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState( |
| 921 | ChecklistsViewModel.kt | `reorderItem` | fun reorderItem(chitId: String, fromIndex: Int, toIndex: Int) |
| 922 | ChecklistsViewModel.kt | `toggleItem` | fun toggleItem(chitId: String, itemIndex: Int) |

## ui/screens/contacts/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 923 | ContactEditorScreen.kt | `ContactDatesZone` | private fun ContactDatesZone( |
| 924 | ContactEditorScreen.kt | `ContactEditorScreen` | fun ContactEditorScreen( |
| 925 | ContactEditorScreen.kt | `ContactInfoZone` | private fun ContactInfoZone( |
| 926 | ContactEditorScreen.kt | `ContactNotesZone` | private fun ContactNotesZone( |
| 927 | ContactEditorScreen.kt | `ContactProfileImageSection` | private fun ContactProfileImageSection( |
| 928 | ContactEditorScreen.kt | `ContactTagsZone` | private fun ContactTagsZone( |
| 929 | ContactEditorScreen.kt | `DetailsZone` | private fun DetailsZone( |
| 930 | ContactEditorScreen.kt | `MultiValueField` | private fun MultiValueField( |
| 931 | ContactEditorScreen.kt | `NameSection` | private fun NameSection( |
| 932 | ContactEditorScreen.kt | `SecurityZone` | private fun SecurityZone( |
| 933 | ContactEditorScreen.kt | `SocialWebZone` | private fun SocialWebZone( |
| 934 | ContactEditorScreen.kt | `addMulti` | fun addMulti(prop: String, json: String) |
| 935 | ContactEditorScreen.kt | `countMultiValueItems` | private fun countMultiValueItems(json: String): Int |
| 936 | ContactEditorScreen.kt | `openAddressInMaps` | private fun openAddressInMaps(context: android.content.Context, address: String) |
| 937 | ContactEditorScreen.kt | `openSignalMessage` | private fun openSignalMessage(context: android.content.Context, signalValue: String) |
| 938 | ContactEditorScreen.kt | `parseDateEntries` | private fun parseDateEntries(json: String): List<DateEntry> |
| 939 | ContactEditorScreen.kt | `parseMultiValueEntries` | private fun parseMultiValueEntries(json: String): List<MultiValueEntry> |
| 940 | ContactEditorScreen.kt | `serializeDateEntries` | private fun serializeDateEntries(entries: List<DateEntry>): String |
| 941 | ContactEditorScreen.kt | `serializeMultiValueEntries` | private fun serializeMultiValueEntries(entries: List<MultiValueEntry>): String |
| 942 | ContactEditorScreen.kt | `shareContactAsVCard` | private fun shareContactAsVCard(context: android.content.Context, form: ContactFormState) |
| 943 | ContactEditorViewModel.kt | `applyNewContactDefaults` | private fun applyNewContactDefaults() |
| 944 | ContactEditorViewModel.kt | `delete` | fun delete() |
| 945 | ContactEditorViewModel.kt | `discard` | fun discard() |
| 946 | ContactEditorViewModel.kt | `loadCustomColors` | private fun loadCustomColors() |
| 947 | ContactEditorViewModel.kt | `loadExistingContact` | private fun loadExistingContact() |
| 948 | ContactEditorViewModel.kt | `loadProfile` | private fun loadProfile() |
| 949 | ContactEditorViewModel.kt | `save` | fun save() |
| 950 | ContactEditorViewModel.kt | `saveProfile` | private fun saveProfile() |
| 951 | ContactEditorViewModel.kt | `updateField` | fun updateField(updater: (ContactFormState) -> ContactFormState) |
| 952 | ContactEditorViewModel.kt | `updateForm` | fun updateForm(newState: ContactFormState) |
| 953 | ContactListScreen.kt | `ContactListScreen` | fun ContactListScreen( |
| 954 | ContactListScreen.kt | `ContactRow` | private fun ContactRow( |
| 955 | ContactListScreen.kt | `GroupedContactList` | private fun GroupedContactList( |
| 956 | ContactListScreen.kt | `UserRow` | private fun UserRow( |
| 957 | ContactListViewModel.kt | `clearError` | fun clearError() |
| 958 | ContactListViewModel.kt | `clearExportSuccess` | fun clearExportSuccess() |
| 959 | ContactListViewModel.kt | `clearExportedFile` | fun clearExportedFile() |
| 960 | ContactListViewModel.kt | `clearImportResult` | fun clearImportResult() |
| 961 | ContactListViewModel.kt | `exportContacts` | fun exportContacts(format: String) |
| 962 | ContactListViewModel.kt | `getFilenameFromUri` | private fun getFilenameFromUri(uri: Uri): String? |
| 963 | ContactListViewModel.kt | `importFile` | fun importFile(uri: Uri) |
| 964 | ContactListViewModel.kt | `isSectionCollapsed` | fun isSectionCollapsed(sectionId: String): Boolean |
| 965 | ContactListViewModel.kt | `isUserFavorite` | fun isUserFavorite(userId: String): Boolean |
| 966 | ContactListViewModel.kt | `loadCollapsedSections` | private fun loadCollapsedSections(): Set<String> |
| 967 | ContactListViewModel.kt | `loadSwitchableUsers` | private fun loadSwitchableUsers() |
| 968 | ContactListViewModel.kt | `observeContacts` | private fun observeContacts() |
| 969 | ContactListViewModel.kt | `saveCollapsedSections` | private fun saveCollapsedSections(sections: Set<String>) |
| 970 | ContactListViewModel.kt | `toggleFavorite` | fun toggleFavorite(contactId: String) |
| 971 | ContactListViewModel.kt | `toggleGroupedMode` | fun toggleGroupedMode() |
| 972 | ContactListViewModel.kt | `toggleSection` | fun toggleSection(sectionId: String) |
| 973 | ContactListViewModel.kt | `toggleUserFavorite` | fun toggleUserFavorite(userId: String) |
| 974 | ContactListViewModel.kt | `updateGroupedState` | private fun updateGroupedState(contactList: List<ContactEntity>) |
| 975 | ContactListViewModel.kt | `updateSearchQuery` | fun updateSearchQuery(query: String) |
| 976 | ContactTrashScreen.kt | `ContactTrashScreen` | fun ContactTrashScreen( |
| 977 | ContactTrashScreen.kt | `TrashContactRow` | private fun TrashContactRow( |
| 978 | ContactTrashScreen.kt | `formatTrashDate` | private fun formatTrashDate(iso: String): String |
| 979 | ContactTrashViewModel.kt | `bulkPurge` | fun bulkPurge() |
| 980 | ContactTrashViewModel.kt | `bulkRestore` | fun bulkRestore() |
| 981 | ContactTrashViewModel.kt | `clearMessage` | fun clearMessage() |
| 982 | ContactTrashViewModel.kt | `deselectAll` | fun deselectAll() |
| 983 | ContactTrashViewModel.kt | `isAllSelected` | fun isAllSelected(contacts: List<ContactEntity>): Boolean |
| 984 | ContactTrashViewModel.kt | `isSelected` | fun isSelected(contactId: String): Boolean = contactId in _uiState.value.selectedIds |
| 985 | ContactTrashViewModel.kt | `purgeContact` | fun purgeContact(contactId: String) |
| 986 | ContactTrashViewModel.kt | `restoreContact` | fun restoreContact(contactId: String) |
| 987 | ContactTrashViewModel.kt | `selectAll` | fun selectAll(contacts: List<ContactEntity>) |
| 988 | ContactTrashViewModel.kt | `toggleSelectAll` | fun toggleSelectAll(contacts: List<ContactEntity>) |
| 989 | ContactTrashViewModel.kt | `toggleSelection` | fun toggleSelection(contactId: String) |

## ui/screens/customobjects/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 990 | CustomObjectsScreen.kt | `AddObjectsPickerDialog` | private fun AddObjectsPickerDialog( |
| 991 | CustomObjectsScreen.kt | `CreateZoneDialog` | private fun CreateZoneDialog( |
| 992 | CustomObjectsScreen.kt | `CustomObjectsScreen` | fun CustomObjectsScreen( |
| 993 | CustomObjectsScreen.kt | `CustomZonesSection` | private fun CustomZonesSection( |
| 994 | CustomObjectsScreen.kt | `EditObjectDialog` | private fun EditObjectDialog( |
| 995 | CustomObjectsScreen.kt | `FilterToolbar` | private fun FilterToolbar( |
| 996 | CustomObjectsScreen.kt | `IndicatorsZoneSection` | private fun IndicatorsZoneSection(indicators: List<ZoneObject>) |
| 997 | CustomObjectsScreen.kt | `ObjectRow` | private fun ObjectRow( |
| 998 | CustomObjectsScreen.kt | `TypeGroupSection` | private fun TypeGroupSection( |
| 999 | CustomObjectsScreen.kt | `ZoneEditorDialog` | private fun ZoneEditorDialog( |
| 1000 | CustomObjectsScreen.kt | `ZoneObjectCard` | private fun ZoneObjectCard( |
| 1001 | CustomObjectsViewModel.kt | `addObjectToZone` | fun addObjectToZone(objectId: String, zoneId: String, sortOrder: Int = 0) |
| 1002 | CustomObjectsViewModel.kt | `applyFilters` | private fun applyFilters() |
| 1003 | CustomObjectsViewModel.kt | `clearError` | fun clearError() |
| 1004 | CustomObjectsViewModel.kt | `createObject` | fun createObject( |
| 1005 | CustomObjectsViewModel.kt | `createZone` | fun createZone(name: String, onSuccess: (CustomZone) -> Unit |
| 1006 | CustomObjectsViewModel.kt | `deleteObject` | fun deleteObject(id: String) |
| 1007 | CustomObjectsViewModel.kt | `deleteZone` | fun deleteZone(zoneId: String) |
| 1008 | CustomObjectsViewModel.kt | `getAvailableObjectsForZone` | fun getAvailableObjectsForZone(zoneId: String): List<CustomObject> |
| 1009 | CustomObjectsViewModel.kt | `getAvailableTypes` | fun getAvailableTypes(): List<String> |
| 1010 | CustomObjectsViewModel.kt | `getBaseUrl` | private fun getBaseUrl(): String? |
| 1011 | CustomObjectsViewModel.kt | `loadAll` | fun loadAll() |
| 1012 | CustomObjectsViewModel.kt | `loadZoneObjects` | fun loadZoneObjects(zoneId: String) |
| 1013 | CustomObjectsViewModel.kt | `removeObjectFromZone` | fun removeObjectFromZone(objectId: String, zoneId: String) |
| 1014 | CustomObjectsViewModel.kt | `renameZone` | fun renameZone(zoneId: String, newName: String) |
| 1015 | CustomObjectsViewModel.kt | `reorderIndicators` | fun reorderIndicators(orderedObjectIds: List<String>) |
| 1016 | CustomObjectsViewModel.kt | `reorderZoneObjects` | fun reorderZoneObjects(zoneId: String, orderedObjectIds: List<String>) |
| 1017 | CustomObjectsViewModel.kt | `reorderZones` | fun reorderZones(orderedZoneIds: List<String>) |
| 1018 | CustomObjectsViewModel.kt | `restoreObject` | fun restoreObject(id: String) |
| 1019 | CustomObjectsViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| 1020 | CustomObjectsViewModel.kt | `setTypeFilter` | fun setTypeFilter(type: String) |
| 1021 | CustomObjectsViewModel.kt | `toggleActive` | fun toggleActive(objectId: String, newActive: Boolean) |
| 1022 | CustomObjectsViewModel.kt | `updateObject` | fun updateObject( |

## ui/screens/editor/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1023 | ChitEditorScreen.kt | `ChipInputField` | private fun ChipInputField( |
| 1024 | ChitEditorScreen.kt | `ChitEditorScreen` | fun ChitEditorScreen( |
| 1025 | ChitEditorScreen.kt | `DropdownField` | private fun DropdownField( |
| 1026 | ChitEditorScreen.kt | `FullEditorModal` | private fun FullEditorModal( |
| 1027 | ChitEditorScreen.kt | `HealthIndicatorsZone` | private fun HealthIndicatorsZone( |
| 1028 | ChitEditorScreen.kt | `LocationZone` | private fun LocationZone( |
| 1029 | ChitEditorScreen.kt | `NotesFormatToolbar` | private fun NotesFormatToolbar( |
| 1030 | ChitEditorScreen.kt | `NotesZone` | private fun NotesZone( |
| 1031 | ChitEditorScreen.kt | `PeopleZone` | private fun PeopleZone( |
| 1032 | ChitEditorScreen.kt | `PrerequisitesZone` | private fun PrerequisitesZone( |
| 1033 | ChitEditorScreen.kt | `ProjectsZone` | private fun ProjectsZone( |
| 1034 | ChitEditorScreen.kt | `SeriesLogZone` | private fun SeriesLogZone(chitId: String) |
| 1035 | ChitEditorScreen.kt | `TagsZone` | private fun TagsZone( |
| 1036 | ChitEditorScreen.kt | `TitleMetadataRow` | private fun TitleMetadataRow(formState: ChitFormState) |
| 1037 | ChitEditorScreen.kt | `autoListContinuation` | private fun autoListContinuation(oldText: String, newText: String): String |
| 1038 | ChitEditorScreen.kt | `buildShareText` | private fun buildShareText(form: ChitFormState): String |
| 1039 | ChitEditorScreen.kt | `contrastTextColorLocal` | private fun contrastTextColorLocal(background: Color): Color |
| 1040 | ChitEditorScreen.kt | `getLatestValue` | private fun getLatestValue(value: Any?): String |
| 1041 | ChitEditorScreen.kt | `parseTagColorLocal` | private fun parseTagColorLocal(hex: String): Color |
| 1042 | ChitEditorScreen.kt | `prependLine` | private fun prependLine(text: String, prefix: String): String |
| 1043 | ChitEditorScreen.kt | `pushUndo` | fun pushUndo(oldValue: String) |
| 1044 | ChitEditorScreen.kt | `walk` | fun walk(nodes: List<TagNode>) |
| 1045 | ChitEditorScreen.kt | `wrapSelection` | private fun wrapSelection( |
| 1046 | ChitEditorViewModel.kt | `cancelBack` | fun cancelBack() |
| 1047 | ChitEditorViewModel.kt | `deleteChit` | fun deleteChit() |
| 1048 | ChitEditorViewModel.kt | `discard` | fun discard() |
| 1049 | ChitEditorViewModel.kt | `discardAndExit` | fun discardAndExit() |
| 1050 | ChitEditorViewModel.kt | `discardEmailDraft` | fun discardEmailDraft() |
| 1051 | ChitEditorViewModel.kt | `dismissConflict` | fun dismissConflict() |
| 1052 | ChitEditorViewModel.kt | `duplicateChit` | fun duplicateChit() |
| 1053 | ChitEditorViewModel.kt | `loadChildChitSummaries` | fun loadChildChitSummaries(childIds: List<String>?) |
| 1054 | ChitEditorViewModel.kt | `loadContactNames` | private fun loadContactNames() |
| 1055 | ChitEditorViewModel.kt | `loadEditorSettings` | private fun loadEditorSettings() |
| 1056 | ChitEditorViewModel.kt | `loadExistingChit` | private fun loadExistingChit() |
| 1057 | ChitEditorViewModel.kt | `loadIndicatorObjects` | private fun loadIndicatorObjects() |
| 1058 | ChitEditorViewModel.kt | `loadRecentTags` | private fun loadRecentTags() |
| 1059 | ChitEditorViewModel.kt | `loadTagTree` | private fun loadTagTree() |
| 1060 | ChitEditorViewModel.kt | `onBackPressed` | fun onBackPressed() |
| 1061 | ChitEditorViewModel.kt | `onTagCreated` | fun onTagCreated(tagName: String) |
| 1062 | ChitEditorViewModel.kt | `parseConflictFields` | private fun parseConflictFields(json: String?): List<String> |
| 1063 | ChitEditorViewModel.kt | `registerOnDiscardCallback` | fun registerOnDiscardCallback(callback: suspend () -> Unit) |
| 1064 | ChitEditorViewModel.kt | `registerOnSaveCallback` | fun registerOnSaveCallback(callback: suspend () -> Unit) |
| 1065 | ChitEditorViewModel.kt | `save` | fun save() |
| 1066 | ChitEditorViewModel.kt | `saveAndExit` | fun saveAndExit() |
| 1067 | ChitEditorViewModel.kt | `saveAndStay` | fun saveAndStay() |
| 1068 | ChitEditorViewModel.kt | `searchChitTitles` | fun searchChitTitles(query: String) |
| 1069 | ChitEditorViewModel.kt | `sendEmail` | fun sendEmail() |
| 1070 | ChitEditorViewModel.kt | `trackRecentTag` | fun trackRecentTag(tagPath: String) |
| 1071 | ChitEditorViewModel.kt | `updateChildChitStatus` | fun updateChildChitStatus(childId: String, newStatus: String) |
| 1072 | ChitEditorViewModel.kt | `updateForm` | fun updateForm(newState: ChitFormState) |
| 1073 | EditorZoneState.kt | `buildDatesText` | private fun buildDatesText(formState: ChitFormState): String |
| 1074 | EditorZoneState.kt | `buildOverviewRows` | fun buildOverviewRows(formState: ChitFormState): List<com.cwoc.app.ui.screens.editor.zones.OverviewRow> |
| 1075 | EditorZoneState.kt | `getStartingZoneIndex` | fun getStartingZoneIndex(sourceTab: String?, hasDatePrefill: Boolean): Int |
| 1076 | EditorZoneState.kt | `isZoneEmpty` | fun isZoneEmpty(zoneId: String, formState: ChitFormState): Boolean |
| 1077 | EditorZoneState.kt | `navigateTo` | fun navigateTo(index: Int) |
| 1078 | EditorZoneState.kt | `navigateToZoneId` | fun navigateToZoneId(zoneId: String) |
| 1079 | EditorZoneState.kt | `nextZone` | fun nextZone() |
| 1080 | EditorZoneState.kt | `prevZone` | fun prevZone() |
| 1081 | EditorZoneState.kt | `rememberEditorZoneState` | fun rememberEditorZoneState( |
| 1082 | EditorZoneState.kt | `updateVisibleZones` | fun updateVisibleZones(formState: ChitFormState) |

## ui/screens/editor/zones/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1083 | AlertsZone.kt | `AddAlertForm` | private fun AddAlertForm( |
| 1084 | AlertsZone.kt | `AlertRow` | private fun AlertRow( |
| 1085 | AlertsZone.kt | `AlertTypeSelector` | private fun AlertTypeSelector( |
| 1086 | AlertsZone.kt | `AlertsZone` | fun AlertsZone( |
| 1087 | AlertsZone.kt | `OffsetPicker` | private fun OffsetPicker( |
| 1088 | AlertsZone.kt | `alertTypeIcon` | private fun alertTypeIcon(type: String): ImageVector |
| 1089 | AlertsZone.kt | `alertTypeLabel` | private fun alertTypeLabel(type: String): String |
| 1090 | AlertsZone.kt | `formatAlertDescription` | private fun formatAlertDescription(alert: AlertItem, timeFormat: String): String |
| 1091 | AlertsZone.kt | `formatOffsetMinutes` | internal fun formatOffsetMinutes(minutes: Int): String |
| 1092 | AlertsZone.kt | `formatTimeForDisplay` | private fun formatTimeForDisplay(timeStr: String, timeFormat: String): String |
| 1093 | AlertsZone.kt | `parseAlertsJson` | internal fun parseAlertsJson(json: String?): List<AlertItem> |
| 1094 | AlertsZone.kt | `parseTimeString` | private fun parseTimeString(timeStr: String): LocalTime? |
| 1095 | AlertsZone.kt | `serializeAlerts` | internal fun serializeAlerts(alerts: List<AlertItem>): String? |
| 1096 | AlertsZone.kt | `weatherConditionLabel` | private fun weatherConditionLabel(condition: String): String |
| 1097 | AttachmentsZone.kt | `AttachmentRow` | private fun AttachmentRow( |
| 1098 | AttachmentsZone.kt | `AttachmentsZone` | fun AttachmentsZone( |
| 1099 | AttachmentsZone.kt | `formatFileSize` | private fun formatFileSize(bytes: Long): String |
| 1100 | AttachmentsZone.kt | `getFileTypeIcon` | private fun getFileTypeIcon(filenameOrMime: String): ImageVector |
| 1101 | AttachmentsZone.kt | `getFilenameFromUri` | private fun getFilenameFromUri(context: Context, uri: Uri): String? |
| 1102 | AttachmentsZone.kt | `parseAttachments` | private fun parseAttachments(json: String?): List<AttachmentInfo> |
| 1103 | ChecklistZone.kt | `ChecklistItemRow` | private fun ChecklistItemRow( |
| 1104 | ChecklistZone.kt | `ChecklistZone` | fun ChecklistZone( |
| 1105 | ChecklistZone.kt | `applyChange` | fun applyChange(newItems: List<ChecklistItem>) |
| 1106 | ChecklistZone.kt | `performUndo` | fun performUndo() |
| 1107 | ChecklistZoneV2.kt | `ChecklistAddItemInput` | private fun ChecklistAddItemInput( |
| 1108 | ChecklistZoneV2.kt | `ChecklistCompletedSectionV2` | private fun ChecklistCompletedSectionV2( |
| 1109 | ChecklistZoneV2.kt | `ChecklistDataMenuSheet` | private fun ChecklistDataMenuSheet( |
| 1110 | ChecklistZoneV2.kt | `ChecklistItemRowV2` | private fun ChecklistItemRowV2( |
| 1111 | ChecklistZoneV2.kt | `ChecklistMultiSelectToolbar` | private fun ChecklistMultiSelectToolbar( |
| 1112 | ChecklistZoneV2.kt | `ChecklistZoneHeader` | private fun ChecklistZoneHeader( |
| 1113 | ChecklistZoneV2.kt | `ChecklistZoneV2` | fun ChecklistZoneV2( |
| 1114 | ChecklistZoneV2.kt | `DataMenuItem` | private fun DataMenuItem(icon: String, label: String, onClick: () -> Unit) |
| 1115 | ChecklistZoneV2.kt | `ToolbarButton` | private fun ToolbarButton(label: String, onClick: () -> Unit) |
| 1116 | ChecklistZoneViewModel.kt | `addItem` | fun addItem(text: String) |
| 1117 | ChecklistZoneViewModel.kt | `applyChange` | fun applyChange(newItems: List<ChecklistItemV2>) |
| 1118 | ChecklistZoneViewModel.kt | `applyChangeQuiet` | fun applyChangeQuiet(newItems: List<ChecklistItemV2>) |
| 1119 | ChecklistZoneViewModel.kt | `checkSelected` | fun checkSelected() |
| 1120 | ChecklistZoneViewModel.kt | `cleanUpEmptyItems` | fun cleanUpEmptyItems() |
| 1121 | ChecklistZoneViewModel.kt | `clearCheckedItems` | fun clearCheckedItems() |
| 1122 | ChecklistZoneViewModel.kt | `clearSelection` | fun clearSelection() |
| 1123 | ChecklistZoneViewModel.kt | `clearUncheckedItems` | fun clearUncheckedItems() |
| 1124 | ChecklistZoneViewModel.kt | `commitPendingContent` | fun commitPendingContent() |
| 1125 | ChecklistZoneViewModel.kt | `deleteItem` | fun deleteItem(itemId: String) |
| 1126 | ChecklistZoneViewModel.kt | `deleteSelected` | fun deleteSelected() |
| 1127 | ChecklistZoneViewModel.kt | `getIncompleteAsMarkdown` | fun getIncompleteAsMarkdown(): String? |
| 1128 | ChecklistZoneViewModel.kt | `hasPendingContent` | fun hasPendingContent(): Boolean |
| 1129 | ChecklistZoneViewModel.kt | `indentItem` | fun indentItem(itemId: String) |
| 1130 | ChecklistZoneViewModel.kt | `indentSelected` | fun indentSelected() |
| 1131 | ChecklistZoneViewModel.kt | `indentSubtree` | fun indentSubtree(itemId: String) |
| 1132 | ChecklistZoneViewModel.kt | `isAutoSaveActive` | private fun isAutoSaveActive(): Boolean |
| 1133 | ChecklistZoneViewModel.kt | `loadItems` | fun loadItems(json: String?) |
| 1134 | ChecklistZoneViewModel.kt | `moveAbove` | fun moveAbove(draggedId: String, targetId: String) |
| 1135 | ChecklistZoneViewModel.kt | `moveBelow` | fun moveBelow(draggedId: String, targetId: String) |
| 1136 | ChecklistZoneViewModel.kt | `moveChecklistToNote` | fun moveChecklistToNote(): String |
| 1137 | ChecklistZoneViewModel.kt | `moveNoteToChecklist` | fun moveNoteToChecklist(noteText: String) |
| 1138 | ChecklistZoneViewModel.kt | `moveOnto` | fun moveOnto(draggedId: String, targetId: String) |
| 1139 | ChecklistZoneViewModel.kt | `notifyChange` | private fun notifyChange() |
| 1140 | ChecklistZoneViewModel.kt | `outdentItem` | fun outdentItem(itemId: String) |
| 1141 | ChecklistZoneViewModel.kt | `outdentSelected` | fun outdentSelected() |
| 1142 | ChecklistZoneViewModel.kt | `outdentSubtree` | fun outdentSubtree(itemId: String) |
| 1143 | ChecklistZoneViewModel.kt | `pasteItems` | fun pasteItems(text: String) |
| 1144 | ChecklistZoneViewModel.kt | `pushUndoState` | private fun pushUndoState() |
| 1145 | ChecklistZoneViewModel.kt | `rangeSelectTo` | fun rangeSelectTo(itemId: String) |
| 1146 | ChecklistZoneViewModel.kt | `redo` | fun redo() |
| 1147 | ChecklistZoneViewModel.kt | `selectAll` | fun selectAll() |
| 1148 | ChecklistZoneViewModel.kt | `splitItem` | fun splitItem(itemId: String, cursorPos: Int): String |
| 1149 | ChecklistZoneViewModel.kt | `toggleAutoSaveOverride` | fun toggleAutoSaveOverride() |
| 1150 | ChecklistZoneViewModel.kt | `toggleCheck` | fun toggleCheck(itemId: String) |
| 1151 | ChecklistZoneViewModel.kt | `toggleSelectItem` | fun toggleSelectItem(itemId: String) |
| 1152 | ChecklistZoneViewModel.kt | `triggerAutoSave` | private fun triggerAutoSave() |
| 1153 | ChecklistZoneViewModel.kt | `undo` | fun undo() |
| 1154 | ChecklistZoneViewModel.kt | `updateItemText` | fun updateItemText(itemId: String, newText: String) |
| 1155 | ColorZone.kt | `ColorSwatch` | private fun ColorSwatch( |
| 1156 | ColorZone.kt | `ColorZone` | fun ColorZone( |
| 1157 | ColorZone.kt | `getColorName` | private fun getColorName(hex: String): String |
| 1158 | ColorZone.kt | `parseHexColor` | internal fun parseHexColor(hex: String): Color |
| 1159 | DateZone.kt | `AllDayButton` | private fun AllDayButton(isActive: Boolean, isDisabled: Boolean, onClick: () -> Unit) |
| 1160 | DateZone.kt | `DateZone` | fun DateZone( |
| 1161 | DateZone.kt | `InlineRecurrenceRow` | private fun InlineRecurrenceRow( |
| 1162 | DateZone.kt | `ParchmentDateField` | private fun ParchmentDateField( |
| 1163 | DateZone.kt | `ParchmentTimeButton` | private fun ParchmentTimeButton( |
| 1164 | DateZone.kt | `TimezoneLabel` | private fun TimezoneLabel( |
| 1165 | DateZone.kt | `applyDateMode` | private fun applyDateMode( |
| 1166 | DateZone.kt | `applyDefaultNotifications` | private fun applyDefaultNotifications( |
| 1167 | DateZone.kt | `buildContextualFreqOptions` | private fun buildContextualFreqOptions(activeDate: LocalDate?): List<Pair<String, String>> |
| 1168 | DateZone.kt | `buildHabitFreqOptions` | private fun buildHabitFreqOptions(): List<Pair<String, String>> |
| 1169 | DateZone.kt | `deriveDateMode` | private fun deriveDateMode( |
| 1170 | DateZone.kt | `formatDateForDisplay` | private fun formatDateForDisplay(value: String?): String |
| 1171 | DateZone.kt | `formatDatetimeForDisplay` | internal fun formatDatetimeForDisplay(value: String?, allDay: Boolean, timeFormat: String): String |
| 1172 | DateZone.kt | `formatTimeForDisplay` | private fun formatTimeForDisplay(value: String?, timeFormat: String): String |
| 1173 | DateZone.kt | `getTimezoneAbbr` | private fun getTimezoneAbbr(tzId: String): String |
| 1174 | DateZone.kt | `getTimezoneFullName` | private fun getTimezoneFullName(tzId: String): String |
| 1175 | DateZone.kt | `parseIsoDatetime` | private fun parseIsoDatetime(value: String?): LocalDateTime? |
| 1176 | DateZone.kt | `parseIsoDatetimeInternal` | private fun parseIsoDatetimeInternal(value: String?): LocalDateTime? |
| 1177 | DateZone.kt | `snapMinute` | internal fun snapMinute(minute: Int, snapMinutes: Int): Int |
| 1178 | DateZone.kt | `snapTime` | internal fun snapTime(time: LocalTime, snapMinutes: Int): LocalTime |
| 1179 | EditorZoneHeader.kt | `EditorZoneHeader` | fun EditorZoneHeader( |
| 1180 | EditorZoneNav.kt | `ActionsSidebar` | fun ActionsSidebar( |
| 1181 | EditorZoneNav.kt | `EditorZoneNavHeader` | fun EditorZoneNavHeader( |
| 1182 | EditorZoneNav.kt | `OverviewZoneContent` | fun OverviewZoneContent( |
| 1183 | EditorZoneNav.kt | `UnsavedDot` | fun UnsavedDot(modifier: Modifier = Modifier) |
| 1184 | EditorZoneNav.kt | `ZoneListPanel` | fun ZoneListPanel( |
| 1185 | EditorZoneNav.kt | `contrastColor` | fun contrastColor(bg: Color): Color |
| 1186 | EmailComposeZone.kt | `DraftComposeContent` | private fun DraftComposeContent( |
| 1187 | EmailComposeZone.kt | `EmailComposeZone` | fun EmailComposeZone( |
| 1188 | EmailComposeZone.kt | `ReadOnlyEmailField` | private fun ReadOnlyEmailField(label: String, value: String?) |
| 1189 | EmailComposeZone.kt | `ReceivedEmailContent` | private fun ReceivedEmailContent( |
| 1190 | EmailComposeZone.kt | `RecipientChipField` | private fun RecipientChipField( |
| 1191 | EmailComposeZone.kt | `SentEmailContent` | private fun SentEmailContent( |
| 1192 | EmailComposeZone.kt | `parseRecipients` | private fun parseRecipients(recipientString: String?): List<String> |
| 1193 | HabitsZone.kt | `FrequencyDropdown` | private fun FrequencyDropdown( |
| 1194 | HabitsZone.kt | `HabitStatsDisplay` | private fun HabitStatsDisplay( |
| 1195 | HabitsZone.kt | `HabitsZone` | fun HabitsZone( |
| 1196 | HabitsZone.kt | `ResetPeriodDropdown` | private fun ResetPeriodDropdown( |
| 1197 | HabitsZone.kt | `calculateStreak` | internal fun calculateStreak(lastActionDate: String?, resetPeriod: String?): Int |
| 1198 | HabitsZone.kt | `generateCompletionHistory` | private fun generateCompletionHistory(success: Int, goal: Int, streak: Int): List<Float> |
| 1199 | HabitsZone.kt | `generatePeriodHistory` | private fun generatePeriodHistory( |
| 1200 | HabitsZone.kt | `generateStreakHistory` | private fun generateStreakHistory(currentStreak: Int): List<Float> |
| 1201 | HabitsZone.kt | `generateSuccessRateHistory` | private fun generateSuccessRateHistory(currentRate: Int): List<Float> |
| 1202 | RecurrenceZone.kt | `CustomRecurrenceBuilder` | private fun CustomRecurrenceBuilder( |
| 1203 | RecurrenceZone.kt | `PresetSelector` | private fun PresetSelector( |
| 1204 | RecurrenceZone.kt | `RecurrenceExceptionsDisplay` | private fun RecurrenceExceptionsDisplay(exceptions: List<String>) |
| 1205 | RecurrenceZone.kt | `RecurrenceZone` | fun RecurrenceZone( |
| 1206 | RecurrenceZone.kt | `determinePreset` | private fun determinePreset(rule: RecurrenceRule?): RecurrencePreset |
| 1207 | RecurrenceZone.kt | `formatExceptionDate` | private fun formatExceptionDate(dateStr: String): String |
| 1208 | RecurrenceZone.kt | `formatUntilDate` | private fun formatUntilDate(dateStr: String): String |
| 1209 | RecurrenceZone.kt | `parseExceptions` | private fun parseExceptions(exceptionsJson: String?, gson: Gson): List<String> |
| 1210 | RecurrenceZone.kt | `parseRecurrenceRule` | private fun parseRecurrenceRule(ruleJson: String?, gson: Gson): RecurrenceRule? |
| 1211 | TagsPickerSheet.kt | `TagTreeRow` | private fun TagTreeRow( |
| 1212 | TagsPickerSheet.kt | `TagsPickerSheet` | fun TagsPickerSheet( |
| 1213 | TagsPickerSheet.kt | `androidx` | private fun androidx.compose.foundation.lazy.LazyListScope.renderTagTree( |
| 1214 | TagsPickerSheet.kt | `collectAllPaths` | private fun collectAllPaths(nodes: List<TagNode>): List<String> |
| 1215 | TagsPickerSheet.kt | `collectFavorites` | private fun collectFavorites(nodes: List<TagNode>): List<TagNode> |
| 1216 | TagsPickerSheet.kt | `contrastTextColor` | private fun contrastTextColor(background: Color): Color |
| 1217 | TagsPickerSheet.kt | `filterTagTree` | private fun filterTagTree(nodes: List<TagNode>, query: String): List<TagNode> |
| 1218 | TagsPickerSheet.kt | `parseTagColor` | private fun parseTagColor(hex: String): Color |
| 1219 | TagsPickerSheet.kt | `walk` | fun walk(list: List<TagNode>) |

## ui/screens/email/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1220 | AccountFilterPills.kt | `AccountFilterPills` | fun AccountFilterPills( |
| 1221 | AccountFilterPills.kt | `AccountPill` | private fun AccountPill( |
| 1222 | AccountFilterPills.kt | `ErrorDetailDialog` | private fun ErrorDetailDialog( |
| 1223 | AccountsModal.kt | `AccountCard` | private fun AccountCard( |
| 1224 | AccountsModal.kt | `AccountEditView` | private fun AccountEditView( |
| 1225 | AccountsModal.kt | `AccountListView` | private fun AccountListView( |
| 1226 | AccountsModal.kt | `AccountsModal` | fun AccountsModal( |
| 1227 | AccountsModal.kt | `ConnectionStatusRow` | private fun ConnectionStatusRow( |
| 1228 | AccountsModal.kt | `SecuritySelector` | private fun SecuritySelector( |
| 1229 | AccountsModal.kt | `TestConnectionSection` | private fun TestConnectionSection( |
| 1230 | AccountsModal.kt | `buildServerSummary` | private fun buildServerSummary(account: EmailAccountConfig): String |
| 1231 | AttachmentBar.kt | `AttachmentBar` | fun AttachmentBar( |
| 1232 | AttachmentBar.kt | `AttachmentChip` | private fun AttachmentChip( |
| 1233 | AttachmentBar.kt | `AttachmentPreviewDialog` | private fun AttachmentPreviewDialog( |
| 1234 | AttachmentBar.kt | `buildAttachmentUrl` | private fun buildAttachmentUrl(url: String?, serverUrl: String): String? |
| 1235 | AttachmentBar.kt | `fileTypeIcon` | private fun fileTypeIcon(contentType: String?, filename: String): ImageVector |
| 1236 | AttachmentBar.kt | `formatFileSize` | private fun formatFileSize(bytes: Long): String |
| 1237 | AttachmentBar.kt | `parseAttachmentBarItems` | private fun parseAttachmentBarItems(attachmentsJson: String?): List<AttachmentBarItem> |
| 1238 | BulkActionsBar.kt | `BulkActionsBar` | fun BulkActionsBar( |
| 1239 | BundleContextMenu.kt | `BundleContextMenu` | fun BundleContextMenu( |
| 1240 | BundleModals.kt | `ColorSwatchPicker` | private fun ColorSwatchPicker( |
| 1241 | BundleModals.kt | `CreateBundleModal` | fun CreateBundleModal( |
| 1242 | BundleModals.kt | `EditBundleModal` | fun EditBundleModal( |
| 1243 | BundleModals.kt | `parseColorHex` | private fun parseColorHex(hex: String): Color |
| 1244 | BundleToolbar.kt | `BundleTabChip` | private fun BundleTabChip( |
| 1245 | BundleToolbar.kt | `BundleTabsRow` | private fun BundleTabsRow( |
| 1246 | BundleToolbar.kt | `BundleToolbar` | fun BundleToolbar( |
| 1247 | BundleToolbar.kt | `DropIndicator` | private fun DropIndicator() |
| 1248 | BundleToolbar.kt | `PriorityArrow` | private fun PriorityArrow() |
| 1249 | BundleToolbar.kt | `calculateDropTarget` | private fun calculateDropTarget( |
| 1250 | BundleToolbar.kt | `parseColor` | private fun parseColor(colorStr: String): Color? |
| 1251 | BundleViewModel.kt | `clearError` | fun clearError() |
| 1252 | BundleViewModel.kt | `createBundle` | fun createBundle( |
| 1253 | BundleViewModel.kt | `deleteBundle` | fun deleteBundle(id: String, onResult: (Result<Unit>) -> Unit |
| 1254 | BundleViewModel.kt | `disableBundle` | fun disableBundle(id: String, onResult: (Result<Unit>) -> Unit |
| 1255 | BundleViewModel.kt | `dismissContextMenu` | fun dismissContextMenu() |
| 1256 | BundleViewModel.kt | `fetchBundles` | fun fetchBundles() |
| 1257 | BundleViewModel.kt | `formatBundleCount` | fun formatBundleCount(unreadCount: Int, totalCount: Int): String |
| 1258 | BundleViewModel.kt | `reorderBundles` | fun reorderBundles(orderedIds: List<String>, onResult: (Result<Unit>) -> Unit |
| 1259 | BundleViewModel.kt | `selectBundle` | fun selectBundle(bundleId: String?) |
| 1260 | BundleViewModel.kt | `showContextMenu` | fun showContextMenu(bundleId: String) |
| 1261 | BundleViewModel.kt | `startReordering` | fun startReordering() |
| 1262 | BundleViewModel.kt | `stopReordering` | fun stopReordering() |
| 1263 | BundleViewModel.kt | `updateBundle` | fun updateBundle( |
| 1264 | EmailCardEnhanced.kt | `AttachmentThumbnailsRow` | private fun AttachmentThumbnailsRow( |
| 1265 | EmailCardEnhanced.kt | `EmailCardEnhanced` | fun EmailCardEnhanced( |
| 1266 | EmailCardEnhanced.kt | `EmailTagChipsRow` | private fun EmailTagChipsRow( |
| 1267 | EmailCardEnhanced.kt | `StatusBadge` | private fun StatusBadge( |
| 1268 | EmailCardEnhanced.kt | `ThreadCountBadge` | private fun ThreadCountBadge( |
| 1269 | EmailCardEnhanced.kt | `avatarColorForName` | private fun avatarColorForName(name: String): Color |
| 1270 | EmailCardEnhanced.kt | `extractInitial` | private fun extractInitial(displayName: String): String |
| 1271 | EmailCardEnhanced.kt | `extractSenderDisplayName` | private fun extractSenderDisplayName(emailFrom: String?): String |
| 1272 | EmailCardEnhanced.kt | `parseAttachments` | private fun parseAttachments(attachmentsJson: String?): List<AttachmentInfo> |
| 1273 | EmailCardEnhanced.kt | `tagColorFromHash` | private fun tagColorFromHash(tagName: String): Color |
| 1274 | EmailComposeViewModel.kt | `addChipToField` | private fun addChipToField(chip: RecipientChip, field: RecipientField) |
| 1275 | EmailComposeViewModel.kt | `addRecipient` | fun addRecipient(contact: ContactEntity, field: RecipientField) |
| 1276 | EmailComposeViewModel.kt | `applyFormatting` | fun applyFormatting(operation: FormattingOperation, selection: TextSelection) |
| 1277 | EmailComposeViewModel.kt | `applyLink` | fun applyLink(selection: TextSelection, url: String) |
| 1278 | EmailComposeViewModel.kt | `canSendEmail` | fun canSendEmail( |
| 1279 | EmailComposeViewModel.kt | `cancelSchedule` | fun cancelSchedule() |
| 1280 | EmailComposeViewModel.kt | `cancelSend` | fun cancelSend() |
| 1281 | EmailComposeViewModel.kt | `checkExistingDraft` | fun checkExistingDraft( |
| 1282 | EmailComposeViewModel.kt | `chipify` | fun chipify(rawText: String, field: RecipientField) |
| 1283 | EmailComposeViewModel.kt | `clearDecryptedState` | fun clearDecryptedState() |
| 1284 | EmailComposeViewModel.kt | `clearError` | fun clearError() |
| 1285 | EmailComposeViewModel.kt | `clearStatusMessage` | fun clearStatusMessage() |
| 1286 | EmailComposeViewModel.kt | `contactToChip` | private fun contactToChip(contact: ContactEntity): RecipientChip |
| 1287 | EmailComposeViewModel.kt | `decryptBody` | fun decryptBody(password: String) |
| 1288 | EmailComposeViewModel.kt | `extractEmailsFromContact` | private fun extractEmailsFromContact(contact: ContactEntity): List<String> |
| 1289 | EmailComposeViewModel.kt | `findContactByEmail` | private fun findContactByEmail(email: String): ContactEntity? |
| 1290 | EmailComposeViewModel.kt | `getExistingChipEmails` | private fun getExistingChipEmails(): List<String> |
| 1291 | EmailComposeViewModel.kt | `initializeForChit` | fun initializeForChit(chitId: String) |
| 1292 | EmailComposeViewModel.kt | `initiateSend` | fun initiateSend(onNavigateToList: () -> Unit) |
| 1293 | EmailComposeViewModel.kt | `onCleared` | override fun onCleared() |
| 1294 | EmailComposeViewModel.kt | `parseRecipientsToChips` | private fun parseRecipientsToChips(recipientString: String?): List<RecipientChip> |
| 1295 | EmailComposeViewModel.kt | `removeRecipient` | fun removeRecipient(email: String, field: RecipientField) |
| 1296 | EmailComposeViewModel.kt | `saveDraft` | fun saveDraft(onSaved: () -> Unit |
| 1297 | EmailComposeViewModel.kt | `scheduleSend` | fun scheduleSend(sendAt: String, onNavigateToScheduled: () -> Unit) |
| 1298 | EmailComposeViewModel.kt | `sendAndArchive` | fun sendAndArchive(onNavigateToList: () -> Unit) |
| 1299 | EmailComposeViewModel.kt | `startSendCountdown` | private fun startSendCountdown(chitId: String, archiveOriginalMessageId: String?) |
| 1300 | EmailComposeViewModel.kt | `togglePgp` | fun togglePgp() |
| 1301 | EmailComposeViewModel.kt | `toggleReadReceipt` | fun toggleReadReceipt() |
| 1302 | EmailComposeViewModel.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline(chitId: String) |
| 1303 | EmailComposeViewModel.kt | `updateAutocompleteQuery` | fun updateAutocompleteQuery(query: String, field: RecipientField) |
| 1304 | EmailComposeViewModel.kt | `updateBody` | fun updateBody(newBody: String) |
| 1305 | EmailComposeViewModel.kt | `updateCanSend` | private fun updateCanSend() |
| 1306 | EmailComposeViewModel.kt | `updateSubject` | fun updateSubject(newSubject: String) |
| 1307 | EmailComposeViewModel.kt | `updateTitle` | fun updateTitle(newTitle: String) |
| 1308 | EmailComposeViewModel.kt | `validatePgpState` | private fun validatePgpState() |
| 1309 | EmailComposeViewModel.kt | `validateRecipientKeys` | fun validateRecipientKeys(): Boolean |
| 1310 | EmailComposeZone.kt | `EmailComposeZone` | fun EmailComposeZone( |
| 1311 | EmailComposeZone.kt | `MarkdownPreviewBox` | private fun MarkdownPreviewBox( |
| 1312 | EmailComposeZone.kt | `PgpDecryptionBanner` | private fun PgpDecryptionBanner( |
| 1313 | EmailComposeZone.kt | `PgpPasswordDialog` | private fun PgpPasswordDialog( |
| 1314 | EmailComposeZone.kt | `PgpToggleButton` | private fun PgpToggleButton( |
| 1315 | EmailComposeZone.kt | `ScheduledSendIndicator` | private fun ScheduledSendIndicator( |
| 1316 | EmailContextMenu.kt | `EmailContextMenu` | fun EmailContextMenu( |
| 1317 | EmailScreen.kt | `CheckMailAndToggleRow` | private fun CheckMailAndToggleRow( |
| 1318 | EmailScreen.kt | `DateGroupHeader` | private fun DateGroupHeader(dateGroup: DateGroup) |
| 1319 | EmailScreen.kt | `EmailListWithDateGroups` | private fun EmailListWithDateGroups( |
| 1320 | EmailScreen.kt | `EmailScreen` | fun EmailScreen( |
| 1321 | EmailScreen.kt | `EmptyStateWithContext` | private fun EmptyStateWithContext( |
| 1322 | EmailScreen.kt | `LoadMoreButton` | private fun LoadMoreButton( |
| 1323 | EmailSettingsScreen.kt | `AccountsSection` | private fun AccountsSection( |
| 1324 | EmailSettingsScreen.kt | `AutoBundleToggleRow` | private fun AutoBundleToggleRow( |
| 1325 | EmailSettingsScreen.kt | `BackfillSection` | private fun BackfillSection( |
| 1326 | EmailSettingsScreen.kt | `BundleSection` | private fun BundleSection( |
| 1327 | EmailSettingsScreen.kt | `CheckboxRow` | private fun CheckboxRow( |
| 1328 | EmailSettingsScreen.kt | `DisplaySection` | private fun DisplaySection( |
| 1329 | EmailSettingsScreen.kt | `DropdownSelector` | private fun DropdownSelector( |
| 1330 | EmailSettingsScreen.kt | `EmailSettingsScreen` | fun EmailSettingsScreen( |
| 1331 | EmailSettingsScreen.kt | `PrivacySection` | private fun PrivacySection( |
| 1332 | EmailSettingsScreen.kt | `SectionDivider` | private fun SectionDivider() |
| 1333 | EmailSettingsScreen.kt | `SectionHeader` | private fun SectionHeader(title: String) |
| 1334 | EmailSettingsScreen.kt | `SignatureSection` | private fun SignatureSection( |
| 1335 | EmailSettingsViewModel.kt | `addAccount` | fun addAccount(account: EmailAccountConfig) |
| 1336 | EmailSettingsViewModel.kt | `backfillEstimate` | fun backfillEstimate() |
| 1337 | EmailSettingsViewModel.kt | `clearBackfillState` | fun clearBackfillState() |
| 1338 | EmailSettingsViewModel.kt | `clearError` | fun clearError() |
| 1339 | EmailSettingsViewModel.kt | `clearTestConnectionState` | fun clearTestConnectionState() |
| 1340 | EmailSettingsViewModel.kt | `deleteAccount` | fun deleteAccount(index: Int) |
| 1341 | EmailSettingsViewModel.kt | `editAccount` | fun editAccount(index: Int, account: EmailAccountConfig) |
| 1342 | EmailSettingsViewModel.kt | `loadSettings` | fun loadSettings() |
| 1343 | EmailSettingsViewModel.kt | `observeBundles` | private fun observeBundles() |
| 1344 | EmailSettingsViewModel.kt | `parseAccountsJson` | fun parseAccountsJson(json: String?): List<EmailAccountConfig> |
| 1345 | EmailSettingsViewModel.kt | `saveSettings` | fun saveSettings() |
| 1346 | EmailSettingsViewModel.kt | `saveSignature` | fun saveSignature() |
| 1347 | EmailSettingsViewModel.kt | `serializeAccountsJson` | fun serializeAccountsJson(accounts: List<EmailAccountConfig>): String |
| 1348 | EmailSettingsViewModel.kt | `testConnection` | fun testConnection(account: EmailAccountConfig) |
| 1349 | EmailSettingsViewModel.kt | `toggleAutoBundle` | fun toggleAutoBundle(bundleId: String, enable: Boolean) |
| 1350 | EmailSettingsViewModel.kt | `triggerBackfill` | fun triggerBackfill() |
| 1351 | EmailSettingsViewModel.kt | `updateBundleSetting` | fun updateBundleSetting(update: (EmailBundleSettings) -> EmailBundleSettings) |
| 1352 | EmailSettingsViewModel.kt | `updateCheckInterval` | fun updateCheckInterval(interval: String) |
| 1353 | EmailSettingsViewModel.kt | `updateDisplaySetting` | fun updateDisplaySetting(update: (EmailDisplaySettings) -> EmailDisplaySettings) |
| 1354 | EmailSettingsViewModel.kt | `updateMaxPull` | fun updateMaxPull(maxPull: String) |
| 1355 | EmailSettingsViewModel.kt | `updatePrivacySetting` | fun updatePrivacySetting(update: (EmailPrivacySettings) -> EmailPrivacySettings) |
| 1356 | EmailSettingsViewModel.kt | `updateSignature` | fun updateSignature(signature: String) |
| 1357 | EmailThreadView.kt | `EmailThreadView` | fun EmailThreadView( |
| 1358 | EmailThreadView.kt | `NestedChitCard` | private fun NestedChitCard( |
| 1359 | EmailThreadView.kt | `formatChitDate` | private fun formatChitDate(dueDatetime: String?, startDatetime: String?): String |
| 1360 | EmailThreadView.kt | `stripNotePreview` | private fun stripNotePreview(note: String?): String |
| 1361 | EmailThreadViewInEditor.kt | `CollapsedThreadView` | private fun CollapsedThreadView( |
| 1362 | EmailThreadViewInEditor.kt | `EmailThreadViewInEditor` | fun EmailThreadViewInEditor( |
| 1363 | EmailThreadViewInEditor.kt | `SimpleThreadList` | private fun SimpleThreadList( |
| 1364 | EmailThreadViewInEditor.kt | `ThreadMessageRow` | private fun ThreadMessageRow( |
| 1365 | EmailThreadViewInEditor.kt | `ThreadNestedChitRow` | private fun ThreadNestedChitRow( |
| 1366 | EmailThreadViewInEditor.kt | `buildThreadDisplayItems` | private fun buildThreadDisplayItems( |
| 1367 | EmailThreadViewInEditor.kt | `extractSenderName` | private fun extractSenderName(from: String?): String |
| 1368 | EmailThreadViewInEditor.kt | `truncateBodyPreview` | private fun truncateBodyPreview(body: String?, maxChars: Int = 100): String |
| 1369 | EmailViewModel.kt | `archive` | fun archive(chitId: String) |
| 1370 | EmailViewModel.kt | `archiveWithUndo` | fun archiveWithUndo(chitId: String, subject: String) |
| 1371 | EmailViewModel.kt | `bulkArchive` | fun bulkArchive(onResult: (Int, Int) -> Unit |
| 1372 | EmailViewModel.kt | `bulkDelete` | fun bulkDelete(onResult: (Int, Int) -> Unit |
| 1373 | EmailViewModel.kt | `bulkToggleRead` | fun bulkToggleRead() |
| 1374 | EmailViewModel.kt | `cancelUndo` | fun cancelUndo() |
| 1375 | EmailViewModel.kt | `createForward` | fun createForward(originalChitId: String, onCreated: (String) -> Unit) |
| 1376 | EmailViewModel.kt | `createReply` | fun createReply(originalChitId: String, onCreated: (String) -> Unit) |
| 1377 | EmailViewModel.kt | `deleteWithUndo` | fun deleteWithUndo(chitId: String, subject: String) |
| 1378 | EmailViewModel.kt | `enrichThread` | private fun enrichThread(thread: EmailThread, use24Hour: Boolean): EmailThread |
| 1379 | EmailViewModel.kt | `enterMultiSelect` | fun enterMultiSelect(chitId: String) |
| 1380 | EmailViewModel.kt | `executeUndoAction` | private fun executeUndoAction(action: UndoAction) |
| 1381 | EmailViewModel.kt | `exitMultiSelect` | fun exitMultiSelect() |
| 1382 | EmailViewModel.kt | `filterByFolder` | private fun filterByFolder(chits: List<ChitEntity>, folder: String): List<ChitEntity> |
| 1383 | EmailViewModel.kt | `findNestedChits` | private fun findNestedChits(thread: EmailThread): List<ChitEntity> |
| 1384 | EmailViewModel.kt | `groupIntoThreads` | private fun groupIntoThreads(chits: List<ChitEntity>): List<EmailThread> |
| 1385 | EmailViewModel.kt | `hasReplyIndicator` | private fun hasReplyIndicator(thread: EmailThread): Boolean |
| 1386 | EmailViewModel.kt | `loadMore` | fun loadMore() |
| 1387 | EmailViewModel.kt | `markAsRead` | fun markAsRead(chitId: String) |
| 1388 | EmailViewModel.kt | `markAsUnread` | fun markAsUnread(chitId: String) |
| 1389 | EmailViewModel.kt | `moveToTrash` | fun moveToTrash(chitId: String) |
| 1390 | EmailViewModel.kt | `normalizeSubject` | private fun normalizeSubject(subject: String?): String |
| 1391 | EmailViewModel.kt | `onCleared` | override fun onCleared() |
| 1392 | EmailViewModel.kt | `parseAccountsFromSettings` | private fun parseAccountsFromSettings(accountsJson: String?): List<EmailAccountInfo> |
| 1393 | EmailViewModel.kt | `recomputeState` | private fun recomputeState() |
| 1394 | EmailViewModel.kt | `selectAll` | fun selectAll() |
| 1395 | EmailViewModel.kt | `setAccountFilter` | fun setAccountFilter(accounts: List<String>) |
| 1396 | EmailViewModel.kt | `setBundle` | fun setBundle(bundle: String?) |
| 1397 | EmailViewModel.kt | `setFolder` | fun setFolder(folder: String) |
| 1398 | EmailViewModel.kt | `setupAutoCheckTimer` | private fun setupAutoCheckTimer(interval: String) |
| 1399 | EmailViewModel.kt | `sortThreads` | private fun sortThreads(threads: List<EmailThread>, unreadAtTop: Boolean): List<EmailThread> |
| 1400 | EmailViewModel.kt | `startUndoCountdown` | private fun startUndoCountdown(action: UndoAction) |
| 1401 | EmailViewModel.kt | `toggleAccountFilter` | fun toggleAccountFilter(accountId: String) |
| 1402 | EmailViewModel.kt | `togglePin` | fun togglePin(chitId: String) |
| 1403 | EmailViewModel.kt | `toggleReadState` | fun toggleReadState(chitId: String) |
| 1404 | EmailViewModel.kt | `toggleSelection` | fun toggleSelection(chitId: String) |
| 1405 | EmailViewModel.kt | `toggleUnreadAtTop` | fun toggleUnreadAtTop() |
| 1406 | EmailViewModel.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline(chitId: String) |
| 1407 | EmailViewModel.kt | `triggerSync` | fun triggerSync() |
| 1408 | FormattingToolbar.kt | `FormattingToolbar` | fun FormattingToolbar( |
| 1409 | HtmlEmailRenderer.kt | `ExternalContentBanner` | private fun ExternalContentBanner( |
| 1410 | HtmlEmailRenderer.kt | `HtmlEmailRenderer` | fun HtmlEmailRenderer( |
| 1411 | HtmlEmailRenderer.kt | `HtmlTextToggle` | private fun HtmlTextToggle( |
| 1412 | HtmlEmailRenderer.kt | `HtmlWebView` | private fun HtmlWebView( |
| 1413 | HtmlEmailRenderer.kt | `PlainTextView` | private fun PlainTextView( |
| 1414 | HtmlEmailRenderer.kt | `blockExternalImages` | internal fun blockExternalImages(html: String): String |
| 1415 | HtmlEmailRenderer.kt | `htmlToPlainText` | private fun htmlToPlainText(html: String): String |
| 1416 | HtmlEmailRenderer.kt | `onPageFinished` | override fun onPageFinished(view: WebView?, url: String?) |
| 1417 | HtmlEmailRenderer.kt | `sanitizeHtml` | internal fun sanitizeHtml(html: String): String |
| 1418 | HtmlEmailRenderer.kt | `shouldOverrideUrlLoading` | override fun shouldOverrideUrlLoading( |
| 1419 | RecipientChipField.kt | `AutocompleteResultItem` | private fun AutocompleteResultItem( |
| 1420 | RecipientChipField.kt | `ChipAvatar` | private fun ChipAvatar( |
| 1421 | RecipientChipField.kt | `RecipientChipField` | fun RecipientChipField( |
| 1422 | RecipientChipField.kt | `RecipientChipItem` | private fun RecipientChipItem( |
| 1423 | RecipientChipField.kt | `extractInitial` | private fun extractInitial(text: String): String |
| 1424 | RecipientChipField.kt | `extractPrimaryEmail` | private fun extractPrimaryEmail(contact: ContactEntity): String? |
| 1425 | RecipientChipField.kt | `parseChipColor` | private fun parseChipColor(hex: String): Color? |
| 1426 | SendLaterModal.kt | `SendLaterModal` | fun SendLaterModal( |
| 1427 | SendLaterModal.kt | `isSelectableDate` | override fun isSelectableDate(utcTimeMillis: Long): Boolean |
| 1428 | SendLaterModal.kt | `isSelectableYear` | override fun isSelectableYear(year: Int): Boolean |
| 1429 | SignatureEditorModal.kt | `SignatureEditorModal` | fun SignatureEditorModal( |
| 1430 | SignatureEditorModal.kt | `SignatureMarkdownPreview` | private fun SignatureMarkdownPreview(markdownText: String) |
| 1431 | SignatureEditorModal.kt | `applyMarkdownLink` | private fun applyMarkdownLink(value: TextFieldValue): TextFieldValue |
| 1432 | SignatureEditorModal.kt | `applyMarkdownWrap` | private fun applyMarkdownWrap(value: TextFieldValue, marker: String): TextFieldValue |
| 1433 | SignatureEditorModal.kt | `renderInlineMarkdown` | private fun renderInlineMarkdown(text: String): String |
| 1434 | SmartLinkBadges.kt | `SmartLinkBadges` | fun SmartLinkBadges( |
| 1435 | SmartLinkBadges.kt | `categoryIcon` | private fun categoryIcon(category: String): ImageVector |
| 1436 | TagPickerModal.kt | `TagPickerModal` | fun TagPickerModal( |
| 1437 | TagPickerModal.kt | `TagPickerRow` | private fun TagPickerRow( |
| 1438 | TagPickerModal.kt | `androidx` | private fun androidx.compose.foundation.lazy.LazyListScope.renderTagPickerTree( |
| 1439 | TagPickerModal.kt | `collectAllParentPaths` | private fun collectAllParentPaths(nodes: List<TagNode>): List<String> |
| 1440 | TagPickerModal.kt | `filterTagTree` | private fun filterTagTree(nodes: List<TagNode>, query: String): List<TagNode> |
| 1441 | TagPickerModal.kt | `parseHexColor` | private fun parseHexColor(hex: String): Color |
| 1442 | TagPickerModal.kt | `walk` | fun walk(list: List<TagNode>) |

## ui/screens/help/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1443 | HelpScreen.kt | `HelpErrorState` | private fun HelpErrorState() |
| 1444 | HelpScreen.kt | `HelpLoadingState` | private fun HelpLoadingState() |
| 1445 | HelpScreen.kt | `HelpScreen` | fun HelpScreen( |
| 1446 | HelpScreen.kt | `HelpTopicCard` | private fun HelpTopicCard( |
| 1447 | HelpScreen.kt | `HelpTopicList` | private fun HelpTopicList( |
| 1448 | HelpViewModel.kt | `extractTitle` | private fun extractTitle(content: String, slug: String): String |
| 1449 | HelpViewModel.kt | `formatSlugAsTitle` | private fun formatSlugAsTitle(slug: String): String |
| 1450 | HelpViewModel.kt | `goBack` | fun goBack() |
| 1451 | HelpViewModel.kt | `loadTopics` | private fun loadTopics() |
| 1452 | HelpViewModel.kt | `selectTopic` | fun selectTopic(slug: String) |

## ui/screens/indicators/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1453 | IndicatorsScreen.kt | `CanvasLineChart` | private fun CanvasLineChart( |
| 1454 | IndicatorsScreen.kt | `EmptyIndicatorsState` | private fun EmptyIndicatorsState() |
| 1455 | IndicatorsScreen.kt | `IndicatorChartCard` | private fun IndicatorChartCard(chart: IndicatorChart) |
| 1456 | IndicatorsScreen.kt | `IndicatorsCalendarView` | private fun IndicatorsCalendarView(healthEntries: List<HealthEntry>) |
| 1457 | IndicatorsScreen.kt | `IndicatorsLogView` | private fun IndicatorsLogView(healthEntries: List<HealthEntry>) |
| 1458 | IndicatorsScreen.kt | `IndicatorsModeToggle` | private fun IndicatorsModeToggle( |
| 1459 | IndicatorsScreen.kt | `IndicatorsScreen` | fun IndicatorsScreen( |
| 1460 | IndicatorsScreen.kt | `indicatorTypeColor` | private fun indicatorTypeColor(type: String): Color |
| 1461 | IndicatorsViewModel.kt | `setTimeRange` | fun setTimeRange(range: TimeRange) |

## ui/screens/kiosk/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1462 | KioskScreen.kt | `DayGroup` | private fun DayGroup( |
| 1463 | KioskScreen.kt | `EventRow` | private fun EventRow(chit: KioskChit, onClick: () -> Unit) |
| 1464 | KioskScreen.kt | `KioskScreen` | fun KioskScreen( |
| 1465 | KioskScreen.kt | `PeriodBar` | private fun PeriodBar( |
| 1466 | KioskScreen.kt | `TaskRow` | private fun TaskRow(chit: KioskChit, onClick: () -> Unit) |
| 1467 | KioskScreen.kt | `chitDateKey` | private fun chitDateKey(chit: KioskChit): String |
| 1468 | KioskScreen.kt | `chitDateKeyFromStr` | private fun chitDateKeyFromStr(dateStr: String): String |
| 1469 | KioskScreen.kt | `chitDateStr` | private fun chitDateStr(chit: KioskChit): String |
| 1470 | KioskScreen.kt | `chitInRange` | private fun chitInRange(chit: KioskChit, start: Calendar, end: Calendar): Boolean |
| 1471 | KioskScreen.kt | `dateKey` | private fun dateKey(cal: Calendar): String |
| 1472 | KioskScreen.kt | `fetchData` | private fun fetchData() |
| 1473 | KioskScreen.kt | `formatDayLabel` | private fun formatDayLabel(dayKey: String): String |
| 1474 | KioskScreen.kt | `formatTime` | private fun formatTime(dateStr: String?): String? |
| 1475 | KioskScreen.kt | `getPeriodLabel` | private fun getPeriodLabel(period: KioskPeriod, anchor: Calendar): String |
| 1476 | KioskScreen.kt | `getPeriodRange` | private fun getPeriodRange(period: KioskPeriod, anchor: Calendar): Pair<Calendar, Calendar> |
| 1477 | KioskScreen.kt | `hasDate` | private fun hasDate(chit: KioskChit): Boolean |
| 1478 | KioskScreen.kt | `isActiveTask` | private fun isActiveTask(chit: KioskChit): Boolean |
| 1479 | KioskScreen.kt | `isLightColor` | private fun isLightColor(color: Color): Boolean |
| 1480 | KioskScreen.kt | `parseChitColor` | private fun parseChitColor(color: String?): Color |
| 1481 | KioskScreen.kt | `refresh` | fun refresh() |
| 1482 | KioskScreen.kt | `startLoading` | fun startLoading(selectedTags: List<String>) |
| 1483 | KioskScreen.kt | `statusIcon` | private fun statusIcon(status: String?): String |
| 1484 | KioskScreen.kt | `taskOrder` | private fun taskOrder(chit: KioskChit): Int |

## ui/screens/login/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1485 | LoginScreen.kt | `LoginScreen` | fun LoginScreen( |
| 1486 | LoginViewModel.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| 1487 | LoginViewModel.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| 1488 | LoginViewModel.kt | `fetchLoginMessage` | private fun fetchLoginMessage() |
| 1489 | LoginViewModel.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf() |
| 1490 | LoginViewModel.kt | `isValidServerUrl` | private fun isValidServerUrl(url: String): Boolean |
| 1491 | LoginViewModel.kt | `login` | fun login() |
| 1492 | LoginViewModel.kt | `onPasswordChanged` | fun onPasswordChanged(password: String) |
| 1493 | LoginViewModel.kt | `onServerUrlChanged` | fun onServerUrlChanged(url: String) |
| 1494 | LoginViewModel.kt | `onUsernameChanged` | fun onUsernameChanged(username: String) |

## ui/screens/map/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1495 | MapScreen.kt | `EmptyMapState` | private fun EmptyMapState(mapMode: MapMode = MapMode.CHITS) |
| 1496 | MapScreen.kt | `MapFilters` | private fun MapFilters( |
| 1497 | MapScreen.kt | `MapModeToggle` | private fun MapModeToggle( |
| 1498 | MapScreen.kt | `MapScreen` | fun MapScreen( |
| 1499 | MapScreen.kt | `MapSearchBar` | private fun MapSearchBar( |
| 1500 | MapViewModel.kt | `applyChitFilters` | private fun applyChitFilters(markers: List<ChitMarkerWithEntity>): List<ChitMarker> |
| 1501 | MapViewModel.kt | `chitInDateRange` | private fun chitInDateRange(chit: ChitEntity, start: LocalDate, end: LocalDate): Boolean |
| 1502 | MapViewModel.kt | `clearFilters` | fun clearFilters() |
| 1503 | MapViewModel.kt | `clearFlyTo` | fun clearFlyTo() |
| 1504 | MapViewModel.kt | `clearGoToError` | fun clearGoToError() |
| 1505 | MapViewModel.kt | `computeBounds` | fun computeBounds(markers: List<ChitMarker>): BoundingBox? |
| 1506 | MapViewModel.kt | `createContactMarker` | private fun createContactMarker(contact: ContactEntity, geoPoint: GeoPoint): ChitMarker |
| 1507 | MapViewModel.kt | `extractFirstAddress` | private fun extractFirstAddress(addressesJson: String?): String? |
| 1508 | MapViewModel.kt | `goToAddress` | fun goToAddress(address: String) |
| 1509 | MapViewModel.kt | `isChitOverdue` | private fun isChitOverdue(chit: ChitEntity): Boolean |
| 1510 | MapViewModel.kt | `loadChitMarkers` | private fun loadChitMarkers() |
| 1511 | MapViewModel.kt | `loadContactMarkers` | private fun loadContactMarkers() |
| 1512 | MapViewModel.kt | `loadSettings` | private fun loadSettings() |
| 1513 | MapViewModel.kt | `markerColor` | fun markerColor(colorStr: String?): Int |
| 1514 | MapViewModel.kt | `nextPeriod` | fun nextPeriod() |
| 1515 | MapViewModel.kt | `parseLatLng` | private fun parseLatLng(location: String): Pair<Double, Double>? |
| 1516 | MapViewModel.kt | `parseMarkerWithEntity` | private fun parseMarkerWithEntity(chit: ChitEntity): ChitMarkerWithEntity? |
| 1517 | MapViewModel.kt | `persistMode` | private fun persistMode(mode: MapMode) |
| 1518 | MapViewModel.kt | `previousPeriod` | fun previousPeriod() |
| 1519 | MapViewModel.kt | `resolveChitColor` | private fun resolveChitColor(chit: ChitEntity): Int |
| 1520 | MapViewModel.kt | `restoreMode` | private fun restoreMode(): MapMode |
| 1521 | MapViewModel.kt | `setAllPeople` | fun setAllPeople(enabled: Boolean) |
| 1522 | MapViewModel.kt | `setMapMode` | fun setMapMode(mode: MapMode) |
| 1523 | MapViewModel.kt | `setPeriod` | fun setPeriod(period: MapPeriod) |
| 1524 | MapViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| 1525 | MapViewModel.kt | `togglePriorityFilter` | fun togglePriorityFilter(priority: String) |
| 1526 | MapViewModel.kt | `toggleStatusFilter` | fun toggleStatusFilter(status: String) |
| 1527 | MapViewModel.kt | `updatePeriodLabel` | private fun updatePeriodLabel() |
| 1528 | MapViewModel.kt | `updateVisibleMarkers` | private fun updateVisibleMarkers() |

## ui/screens/notebook/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1529 | NotebookScreen.kt | `NotebookCard` | private fun NotebookCard( |
| 1530 | NotebookScreen.kt | `NotebookScreen` | fun NotebookScreen( |
| 1531 | NotebookScreen.kt | `buildNotebookIndicators` | private fun buildNotebookIndicators(chit: ChitEntity, currentUserId: String): String |
| 1532 | NotebookViewModel.kt | `finalizeDelete` | fun finalizeDelete(chitId: String? = null) |
| 1533 | NotebookViewModel.kt | `softDelete` | fun softDelete(chitId: String) |
| 1534 | NotebookViewModel.kt | `toggleChecklistItem` | fun toggleChecklistItem(chitId: String, itemIndex: Int) |
| 1535 | NotebookViewModel.kt | `undoDelete` | fun undoDelete() |

## ui/screens/notes/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1536 | NotesScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState(onClearFilters: () -> Unit) |
| 1537 | NotesScreen.kt | `NoteCard` | private fun NoteCard( |
| 1538 | NotesScreen.kt | `NotesEmptyState` | private fun NotesEmptyState() |
| 1539 | NotesScreen.kt | `NotesList` | private fun NotesList( |
| 1540 | NotesScreen.kt | `NotesLoadingSkeleton` | private fun NotesLoadingSkeleton() |
| 1541 | NotesScreen.kt | `NotesScreen` | fun NotesScreen( |
| 1542 | NotesScreen.kt | `buildNoteIndicators` | private fun buildNoteIndicators(note: ChitEntity, currentUserId: String): String |
| 1543 | NotesViewModel.kt | `finalizeDelete` | fun finalizeDelete(chitId: String? = null) |
| 1544 | NotesViewModel.kt | `softDelete` | fun softDelete(chitId: String) |
| 1545 | NotesViewModel.kt | `undoDelete` | fun undoDelete() |

## ui/screens/notifications/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1546 | NotificationsScreen.kt | `NotificationCard` | private fun NotificationCard( |
| 1547 | NotificationsScreen.kt | `NotificationsScreen` | fun NotificationsScreen( |
| 1548 | NotificationsViewModel.kt | `accept` | fun accept(id: String) |
| 1549 | NotificationsViewModel.kt | `decline` | fun decline(id: String) |
| 1550 | NotificationsViewModel.kt | `dismiss` | fun dismiss(id: String) |
| 1551 | NotificationsViewModel.kt | `markRead` | fun markRead(id: String) |

## ui/screens/omni/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1552 | OmniLayoutDialog.kt | `OmniLayoutDialog` | fun OmniLayoutDialog( |
| 1553 | OmniLayoutDialog.kt | `OmniLayoutSectionRow` | private fun OmniLayoutSectionRow( |
| 1554 | OmniViewScreen.kt | `DueDateBadge` | private fun DueDateBadge(dueDatetime: String) |
| 1555 | OmniViewScreen.kt | `OmniChitCard` | private fun OmniChitCard( |
| 1556 | OmniViewScreen.kt | `OmniChronoCard` | private fun OmniChronoCard( |
| 1557 | OmniViewScreen.kt | `OmniEmailCard` | private fun OmniEmailCard( |
| 1558 | OmniViewScreen.kt | `OmniEmailPagination` | private fun OmniEmailPagination( |
| 1559 | OmniViewScreen.kt | `OmniEmptySection` | private fun OmniEmptySection(sectionName: String = "") |
| 1560 | OmniViewScreen.kt | `OmniHstBar` | private fun OmniHstBar( |
| 1561 | OmniViewScreen.kt | `OmniPinnedAllCard` | private fun OmniPinnedAllCard( |
| 1562 | OmniViewScreen.kt | `OmniReminderCard` | private fun OmniReminderCard( |
| 1563 | OmniViewScreen.kt | `OmniSectionHeader` | private fun OmniSectionHeader(type: OmniSectionType) |
| 1564 | OmniViewScreen.kt | `OmniSoonCard` | private fun OmniSoonCard( |
| 1565 | OmniViewScreen.kt | `OmniViewScreen` | fun OmniViewScreen( |
| 1566 | OmniViewScreen.kt | `OmniWeatherBar` | private fun OmniWeatherBar( |
| 1567 | OmniViewScreen.kt | `OmniWeatherStrip` | private fun OmniWeatherStrip(data: OmniWeatherData) |
| 1568 | OmniViewScreen.kt | `ReminderTimeUntilBadge` | private fun ReminderTimeUntilBadge(targetDatetime: String) |
| 1569 | OmniViewScreen.kt | `TimeUntilBadge` | private fun TimeUntilBadge(startDatetime: String) |
| 1570 | OmniViewScreen.kt | `computeDueDateText` | private fun computeDueDateText(dueDatetime: String): String |
| 1571 | OmniViewScreen.kt | `computeReminderTimeUntil` | private fun computeReminderTimeUntil(targetDatetime: String): Pair<String, Boolean> |
| 1572 | OmniViewScreen.kt | `computeTimeUntil` | private fun computeTimeUntil(startDatetime: String): String |
| 1573 | OmniViewScreen.kt | `currentDayFraction` | private fun currentDayFraction(): Float |
| 1574 | OmniViewScreen.kt | `formatHstTimeText` | private fun formatHstTimeText(clockMode: String): String |
| 1575 | OmniViewScreen.kt | `isSectionEmpty` | private fun isSectionEmpty( |
| 1576 | OmniViewScreen.kt | `resolveCardColor` | private fun resolveCardColor(chit: ChitEntity, colorMode: String, sectionId: String): Color |
| 1577 | OmniViewScreen.kt | `resolveNormalizedColor` | private fun resolveNormalizedColor(chit: ChitEntity, sectionId: String): Color |
| 1578 | OmniViewScreen.kt | `sectionData` | private fun sectionData( |
| 1579 | OmniViewScreen.kt | `sectionIcon` | private fun sectionIcon(type: OmniSectionType): String = when (type) |
| 1580 | OmniViewScreen.kt | `sectionLabel` | private fun sectionLabel(type: OmniSectionType): String = when (type) |
| 1581 | OmniViewViewModel.kt | `buildHourlyForecast` | private fun buildHourlyForecast( |
| 1582 | OmniViewViewModel.kt | `closeLayoutDialog` | fun closeLayoutDialog() |
| 1583 | OmniViewViewModel.kt | `cycleHstMode` | fun cycleHstMode() |
| 1584 | OmniViewViewModel.kt | `defaultSections` | fun defaultSections(): List<OmniSection> = listOf( |
| 1585 | OmniViewViewModel.kt | `filterChronoAnchored` | private fun filterChronoAnchored( |
| 1586 | OmniViewViewModel.kt | `filterEmailChits` | private fun filterEmailChits(chits: List<ChitEntity>): List<ChitEntity> |
| 1587 | OmniViewViewModel.kt | `filterHstItems` | private fun filterHstItems( |
| 1588 | OmniViewViewModel.kt | `filterOnDeck` | private fun filterOnDeck(chits: List<ChitEntity>): List<ChitEntity> |
| 1589 | OmniViewViewModel.kt | `filterPinnedAll` | private fun filterPinnedAll(chits: List<ChitEntity>): List<ChitEntity> |
| 1590 | OmniViewViewModel.kt | `filterPinnedChecklists` | private fun filterPinnedChecklists(chits: List<ChitEntity>): List<ChitEntity> |
| 1591 | OmniViewViewModel.kt | `filterPinnedNotes` | private fun filterPinnedNotes(chits: List<ChitEntity>): List<ChitEntity> |
| 1592 | OmniViewViewModel.kt | `filterReminders` | private fun filterReminders( |
| 1593 | OmniViewViewModel.kt | `filterSoon` | private fun filterSoon( |
| 1594 | OmniViewViewModel.kt | `formatHstTime` | private fun formatHstTime(ldt: LocalDateTime): String |
| 1595 | OmniViewViewModel.kt | `getChitIcon` | private fun getChitIcon(chit: ChitEntity): String |
| 1596 | OmniViewViewModel.kt | `getPinnedTypeIcon` | fun getPinnedTypeIcon(chit: ChitEntity): String |
| 1597 | OmniViewViewModel.kt | `idToSectionType` | fun idToSectionType(id: String): OmniSectionType? = when (id) |
| 1598 | OmniViewViewModel.kt | `isSnoozed` | private fun isSnoozed(chit: ChitEntity, now: Instant): Boolean |
| 1599 | OmniViewViewModel.kt | `loadSectionConfig` | private fun loadSectionConfig() |
| 1600 | OmniViewViewModel.kt | `loadWeatherData` | private fun loadWeatherData() |
| 1601 | OmniViewViewModel.kt | `observeChits` | private fun observeChits() |
| 1602 | OmniViewViewModel.kt | `openLayoutDialog` | fun openLayoutDialog() |
| 1603 | OmniViewViewModel.kt | `parseToInstant` | private fun parseToInstant(dateStr: String): Instant? |
| 1604 | OmniViewViewModel.kt | `parseToLocalDate` | private fun parseToLocalDate(dateStr: String, zone: ZoneId): LocalDate? |
| 1605 | OmniViewViewModel.kt | `saveLayout` | fun saveLayout(updatedSections: List<OmniSection>) |
| 1606 | OmniViewViewModel.kt | `sectionDisplayName` | fun sectionDisplayName(type: OmniSectionType): String = when (type) |
| 1607 | OmniViewViewModel.kt | `sectionTypeToId` | fun sectionTypeToId(type: OmniSectionType): String = when (type) |
| 1608 | OmniViewViewModel.kt | `toggleEmailExpanded` | fun toggleEmailExpanded() |
| 1609 | OmniViewViewModel.kt | `weatherCodeToCondition` | fun weatherCodeToCondition(code: Int?): String |
| 1610 | OmniViewViewModel.kt | `weatherCodeToIcon` | fun weatherCodeToIcon(code: Int?): String |

## ui/screens/placeholder/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1611 | PlaceholderScreen.kt | `PlaceholderScreen` | fun PlaceholderScreen(title: String) |

## ui/screens/projects/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1612 | KanbanColumn.kt | `String` | fun String?.toKanbanStatus(): KanbanStatus = KanbanStatus.fromString(this) |
| 1613 | KanbanColumn.kt | `fromString` | fun fromString(status: String?): KanbanStatus |
| 1614 | KanbanColumn.kt | `groupByKanbanStatus` | fun groupByKanbanStatus(chits: List<ChitEntity>): Map<KanbanStatus, List<ChitEntity>> |
| 1615 | ProjectsScreen.kt | `EmptyProjectsState` | private fun EmptyProjectsState() |
| 1616 | ProjectsScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState( |
| 1617 | ProjectsScreen.kt | `KanbanBoard` | private fun KanbanBoard( |
| 1618 | ProjectsScreen.kt | `KanbanColumnView` | private fun KanbanColumnView( |
| 1619 | ProjectsScreen.kt | `ProjectCard` | private fun ProjectCard( |
| 1620 | ProjectsScreen.kt | `ProjectsScreen` | fun ProjectsScreen( |
| 1621 | ProjectsViewModel.kt | `createChildChit` | fun createChildChit(projectId: String, title: String) |
| 1622 | ProjectsViewModel.kt | `moveToColumn` | fun moveToColumn(chitId: String, newStatus: KanbanStatus) |
| 1623 | ProjectsViewModel.kt | `toggleExpanded` | fun toggleExpanded(projectId: String) |

## ui/screens/rules/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1624 | RuleEditorScreen.kt | `DropdownField` | private fun DropdownField( |
| 1625 | RuleEditorScreen.kt | `RuleEditorScreen` | fun RuleEditorScreen( |
| 1626 | RuleEditorViewModel.kt | `buildRequestBody` | private fun buildRequestBody(): String |
| 1627 | RuleEditorViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| 1628 | RuleEditorViewModel.kt | `deleteRule` | fun deleteRule(onSuccess: () -> Unit) |
| 1629 | RuleEditorViewModel.kt | `loadRule` | fun loadRule(ruleId: String) |
| 1630 | RuleEditorViewModel.kt | `populateForm` | private fun populateForm(rule: RuleItem) |
| 1631 | RuleEditorViewModel.kt | `saveRule` | fun saveRule(onSuccess: () -> Unit) |
| 1632 | RuleEditorViewModel.kt | `setActionConfigJson` | fun setActionConfigJson(value: String) |
| 1633 | RuleEditorViewModel.kt | `setActionType` | fun setActionType(value: String) |
| 1634 | RuleEditorViewModel.kt | `setCronExpression` | fun setCronExpression(value: String) |
| 1635 | RuleEditorViewModel.kt | `setDescription` | fun setDescription(value: String) |
| 1636 | RuleEditorViewModel.kt | `setEnabled` | fun setEnabled(value: Boolean) |
| 1637 | RuleEditorViewModel.kt | `setEventType` | fun setEventType(value: String) |
| 1638 | RuleEditorViewModel.kt | `setIsHabit` | fun setIsHabit(value: Boolean) |
| 1639 | RuleEditorViewModel.kt | `setName` | fun setName(value: String) |
| 1640 | RuleEditorViewModel.kt | `setTriggerType` | fun setTriggerType(value: String) |
| 1641 | RulesManagerScreen.kt | `EmptyState` | private fun EmptyState() |
| 1642 | RulesManagerScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| 1643 | RulesManagerScreen.kt | `LoadingState` | private fun LoadingState() |
| 1644 | RulesManagerScreen.kt | `RuleCard` | private fun RuleCard( |
| 1645 | RulesManagerScreen.kt | `RulesManagerScreen` | fun RulesManagerScreen( |
| 1646 | RulesManagerScreen.kt | `getTriggerSummary` | private fun getTriggerSummary(rule: RuleItem): String |
| 1647 | RulesManagerViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| 1648 | RulesManagerViewModel.kt | `loadRules` | fun loadRules() |
| 1649 | RulesManagerViewModel.kt | `toggleRule` | fun toggleRule(ruleId: String) |

## ui/screens/search/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1650 | SearchScreen.kt | `PriorityBadge` | private fun PriorityBadge(priority: String) |
| 1651 | SearchScreen.kt | `SearchResultCard` | private fun SearchResultCard( |
| 1652 | SearchScreen.kt | `SearchScreen` | fun SearchScreen( |
| 1653 | SearchScreen.kt | `buildHighlightedText` | private fun buildHighlightedText( |
| 1654 | SearchScreen.kt | `statusColor` | private fun statusColor(status: String): Color |
| 1655 | SearchViewModel.kt | `extractChecklistText` | private fun extractChecklistText(chit: ChitEntity): String? |
| 1656 | SearchViewModel.kt | `extractTerms` | private fun extractTerms(node: SearchNode): List<String> |
| 1657 | SearchViewModel.kt | `findHighlightRanges` | private fun findHighlightRanges(fieldValue: String, term: String): List<IntRange> |
| 1658 | SearchViewModel.kt | `getFieldValue` | private fun getFieldValue(chit: ChitEntity, field: String): String? |
| 1659 | SearchViewModel.kt | `getSearchableFields` | private fun getSearchableFields(chit: ChitEntity): List<Pair<String, String>> |
| 1660 | SearchViewModel.kt | `mergeRanges` | private fun mergeRanges(ranges: List<IntRange>): List<IntRange> |
| 1661 | SearchViewModel.kt | `onQueryChange` | fun onQueryChange(newQuery: String) |
| 1662 | SearchViewModel.kt | `performSearch` | private fun performSearch(queryText: String, chits: List<ChitEntity>): List<SearchResult> |
| 1663 | SearchViewModel.kt | `tokenizeForFieldExtraction` | private fun tokenizeForFieldExtraction(input: String): List<String> |

## ui/screens/settings/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1664 | AdminSettingsTab.kt | `AdminCollapsibleHeader` | private fun AdminCollapsibleHeader( |
| 1665 | AdminSettingsTab.kt | `AdminSettingsTab` | fun AdminSettingsTab( |
| 1666 | AdminSettingsTab.kt | `AdministrationSection` | private fun AdministrationSection( |
| 1667 | AdminSettingsTab.kt | `AttachmentLimitsSubsection` | private fun AttachmentLimitsSubsection( |
| 1668 | AdminSettingsTab.kt | `AuditLogLimitsSubsection` | private fun AuditLogLimitsSubsection( |
| 1669 | AdminSettingsTab.kt | `CalendarExportSection` | private fun CalendarExportSection( |
| 1670 | AdminSettingsTab.kt | `DataManagementSection` | private fun DataManagementSection( |
| 1671 | AdminSettingsTab.kt | `DependentAppsSection` | private fun DependentAppsSection( |
| 1672 | AdminSettingsTab.kt | `DiagnosticsCard` | private fun DiagnosticsCard(title: String, content: @Composable () -> Unit) |
| 1673 | AdminSettingsTab.kt | `DiagnosticsLine` | private fun DiagnosticsLine(label: String, value: String) |
| 1674 | AdminSettingsTab.kt | `HomeAssistantSection` | private fun HomeAssistantSection( |
| 1675 | AdminSettingsTab.kt | `ImportBatchesSubsection` | private fun ImportBatchesSubsection() |
| 1676 | AdminSettingsTab.kt | `KioskSection` | private fun KioskSection( |
| 1677 | AdminSettingsTab.kt | `KioskTagTreeNode` | private fun KioskTagTreeNode( |
| 1678 | AdminSettingsTab.kt | `NtfySection` | private fun NtfySection( |
| 1679 | AdminSettingsTab.kt | `SettingsDropdown` | private fun SettingsDropdown( |
| 1680 | AdminSettingsTab.kt | `TailscaleSection` | private fun TailscaleSection( |
| 1681 | AdminSettingsTab.kt | `VersionUpdatesSection` | private fun VersionUpdatesSection( |
| 1682 | AdminSettingsTab.kt | `buildKioskTagTree` | private fun buildKioskTagTree(tagNames: List<String>): List<KioskTagNode> |
| 1683 | AdminSettingsTab.kt | `formatBytes` | private fun formatBytes(bytes: Long): String |
| 1684 | AdminSettingsTab.kt | `formatVersionDate` | private fun formatVersionDate(isoDatetime: String, timeFormat: String): String |
| 1685 | AdminSettingsTab.kt | `getAppVersion` | private fun getAppVersion(): String |
| 1686 | AdminSettingsTab.kt | `parseKioskSelectedTags` | private fun parseKioskSelectedTags(json: String): List<String> |
| 1687 | AdminSettingsTab.kt | `parseKioskTagsFromJson` | private fun parseKioskTagsFromJson(json: String, systemTags: Set<String>): List<String> |
| 1688 | BadgesSettingsTab.kt | `BadgeCollapsibleHeader` | private fun BadgeCollapsibleHeader( |
| 1689 | BadgesSettingsTab.kt | `BadgeDisplaySection` | private fun BadgeDisplaySection( |
| 1690 | BadgesSettingsTab.kt | `BadgeDropdown` | private fun BadgeDropdown( |
| 1691 | BadgesSettingsTab.kt | `BadgesSettingsTab` | fun BadgesSettingsTab( |
| 1692 | BadgesSettingsTab.kt | `BuiltInDetectorsSection` | private fun BuiltInDetectorsSection( |
| 1693 | BadgesSettingsTab.kt | `CustomDetectorCard` | private fun CustomDetectorCard( |
| 1694 | BadgesSettingsTab.kt | `CustomDetectorsSection` | private fun CustomDetectorsSection( |
| 1695 | BadgesSettingsTab.kt | `DetectorEditDialog` | private fun DetectorEditDialog( |
| 1696 | BadgesSettingsTab.kt | `parseBadgeDetectorsJson` | private fun parseBadgeDetectorsJson(json: String): List<BadgeDetector> |
| 1697 | BadgesSettingsTab.kt | `serializeBadgeDetectorsJson` | private fun serializeBadgeDetectorsJson(detectors: List<BadgeDetector>): String |
| 1698 | BadgesSettingsTab.kt | `updateDetectorEnabled` | private fun updateDetectorEnabled( |
| 1699 | CollectionsSettingsTab.kt | `BorderColorAssignmentDialog` | private fun BorderColorAssignmentDialog( |
| 1700 | CollectionsSettingsTab.kt | `CollapsibleSectionHeader` | private fun CollapsibleSectionHeader( |
| 1701 | CollectionsSettingsTab.kt | `CollectionsSettingsTab` | fun CollectionsSettingsTab( |
| 1702 | CollectionsSettingsTab.kt | `ColorEditDialog` | private fun ColorEditDialog( |
| 1703 | CollectionsSettingsTab.kt | `ColorSwatchWithBorderIndicator` | private fun ColorSwatchWithBorderIndicator( |
| 1704 | CollectionsSettingsTab.kt | `CustomColorsSection` | private fun CustomColorsSection( |
| 1705 | CollectionsSettingsTab.kt | `DefaultNotificationsSection` | private fun DefaultNotificationsSection( |
| 1706 | CollectionsSettingsTab.kt | `EnhancedTagEditDialog` | private fun EnhancedTagEditDialog( |
| 1707 | CollectionsSettingsTab.kt | `LocationEditDialog` | private fun LocationEditDialog( |
| 1708 | CollectionsSettingsTab.kt | `LocationRow` | private fun LocationRow( |
| 1709 | CollectionsSettingsTab.kt | `NotificationOffsetDialog` | private fun NotificationOffsetDialog( |
| 1710 | CollectionsSettingsTab.kt | `NotificationRuleRow` | private fun NotificationRuleRow( |
| 1711 | CollectionsSettingsTab.kt | `SavedLocationsSection` | private fun SavedLocationsSection( |
| 1712 | CollectionsSettingsTab.kt | `TagEditorSection` | private fun TagEditorSection( |
| 1713 | CollectionsSettingsTab.kt | `TagTreeNodeRow` | private fun TagTreeNodeRow( |
| 1714 | CollectionsSettingsTab.kt | `buildTagTree` | private fun buildTagTree(tags: List<TagItem>): List<TagTreeNode> |
| 1715 | CollectionsSettingsTab.kt | `inheritColors` | fun inheritColors(nodes: MutableList<TagTreeNode>, parentColor: String?) |
| 1716 | CollectionsSettingsTab.kt | `isLightColor` | private fun isLightColor(hex: String): Boolean |
| 1717 | CollectionsSettingsTab.kt | `offsetMinutesToValueUnit` | private fun offsetMinutesToValueUnit(offsetMinutes: Int): Pair<Int, String> |
| 1718 | CollectionsSettingsTab.kt | `parseColorsJson` | private fun parseColorsJson(json: String): List<String> |
| 1719 | CollectionsSettingsTab.kt | `parseHexColor` | private fun parseHexColor(hex: String): Color |
| 1720 | CollectionsSettingsTab.kt | `parseLocationsJson` | private fun parseLocationsJson(json: String): List<LocationItem> |
| 1721 | CollectionsSettingsTab.kt | `parseNotificationsJson` | private fun parseNotificationsJson(json: String): NotificationsData |
| 1722 | CollectionsSettingsTab.kt | `parseTagsJson` | private fun parseTagsJson(json: String): List<TagItem> |
| 1723 | CollectionsSettingsTab.kt | `serializeColorsJson` | private fun serializeColorsJson(colors: List<String>): String |
| 1724 | CollectionsSettingsTab.kt | `serializeLocationsJson` | private fun serializeLocationsJson(locations: List<LocationItem>): String |
| 1725 | CollectionsSettingsTab.kt | `serializeNotificationsJson` | private fun serializeNotificationsJson(data: NotificationsData): String |
| 1726 | CollectionsSettingsTab.kt | `serializeTagsJson` | private fun serializeTagsJson(tags: List<TagItem>): String |
| 1727 | CollectionsSettingsTab.kt | `sortLevel` | fun sortLevel(nodes: MutableList<TagTreeNode>) |
| 1728 | DebugViewModel.kt | `fullResync` | fun fullResync() |
| 1729 | DebugViewModel.kt | `loadDebugInfo` | private fun loadDebugInfo() |
| 1730 | DebugViewModel.kt | `syncNow` | fun syncNow() |
| 1731 | EmailSettingsTab.kt | `AccountsSyncingSection` | private fun AccountsSyncingSection( |
| 1732 | EmailSettingsTab.kt | `BadgesSection` | private fun BadgesSection( |
| 1733 | EmailSettingsTab.kt | `CustomDetectorEditDialog` | private fun CustomDetectorEditDialog( |
| 1734 | EmailSettingsTab.kt | `DisplayBundlesSection` | private fun DisplayBundlesSection( |
| 1735 | EmailSettingsTab.kt | `EmailAccountCard` | private fun EmailAccountCard( |
| 1736 | EmailSettingsTab.kt | `EmailAccountEditDialog` | private fun EmailAccountEditDialog( |
| 1737 | EmailSettingsTab.kt | `EmailCollapsibleHeader` | private fun EmailCollapsibleHeader( |
| 1738 | EmailSettingsTab.kt | `EmailDropdown` | private fun EmailDropdown( |
| 1739 | EmailSettingsTab.kt | `EmailSettingsTab` | fun EmailSettingsTab( |
| 1740 | EmailSettingsTab.kt | `PrivacySendingSection` | private fun PrivacySendingSection( |
| 1741 | EmailSettingsTab.kt | `parseBadgeConfig` | private fun parseBadgeConfig(json: String): BadgeConfig |
| 1742 | EmailSettingsTab.kt | `parseEmailAccountsJson` | private fun parseEmailAccountsJson(json: String): List<EmailAccount> |
| 1743 | EmailSettingsTab.kt | `serializeBadgeConfig` | private fun serializeBadgeConfig(config: BadgeConfig): String |
| 1744 | EmailSettingsTab.kt | `serializeEmailAccountsJson` | private fun serializeEmailAccountsJson(accounts: List<EmailAccount>): String |
| 1745 | GeneralSettingsTab.kt | `CustomFiltersSection` | private fun CustomFiltersSection( |
| 1746 | GeneralSettingsTab.kt | `GeneralSettingsTab` | fun GeneralSettingsTab( |
| 1747 | GeneralSettingsTab.kt | `SettingsDropdown` | private fun SettingsDropdown( |
| 1748 | GeneralSettingsTab.kt | `TimezoneOverrideField` | private fun TimezoneOverrideField( |
| 1749 | GeneralSettingsTab.kt | `TimezoneSearchField` | private fun TimezoneSearchField( |
| 1750 | GeneralSettingsTab.kt | `VisualIndicatorRow` | private fun VisualIndicatorRow( |
| 1751 | GeneralSettingsTab.kt | `calendarSnapDisplayLabel` | private fun calendarSnapDisplayLabel(value: String): String |
| 1752 | GeneralSettingsTab.kt | `nearestValidOption` | fun nearestValidOption(value: String, validOptions: List<String>): String |
| 1753 | GeneralSettingsTab.kt | `updateCombineAlerts` | fun updateCombineAlerts(checked: Boolean) |
| 1754 | GeneralSettingsTab.kt | `updateIndicator` | fun updateIndicator(key: String, value: String) |
| 1755 | SettingsScreen.kt | `SettingsScreen` | fun SettingsScreen( |
| 1756 | SettingsViewModel.kt | `buildSavePayload` | fun buildSavePayload(): Map<String, Any?> |
| 1757 | SettingsViewModel.kt | `clearLoadError` | fun clearLoadError() |
| 1758 | SettingsViewModel.kt | `clearSaveError` | fun clearSaveError() |
| 1759 | SettingsViewModel.kt | `connectTailscale` | fun connectTailscale() |
| 1760 | SettingsViewModel.kt | `disableNtfy` | fun disableNtfy() |
| 1761 | SettingsViewModel.kt | `discardChanges` | fun discardChanges() |
| 1762 | SettingsViewModel.kt | `disconnectTailscale` | fun disconnectTailscale() |
| 1763 | SettingsViewModel.kt | `enableNtfy` | fun enableNtfy() |
| 1764 | SettingsViewModel.kt | `initTailscaleSavedState` | fun initTailscaleSavedState() |
| 1765 | SettingsViewModel.kt | `loadBundles` | private fun loadBundles() |
| 1766 | SettingsViewModel.kt | `loadHaConfig` | fun loadHaConfig() |
| 1767 | SettingsViewModel.kt | `loadSettings` | private fun loadSettings() |
| 1768 | SettingsViewModel.kt | `mapEntityToFormState` | private fun mapEntityToFormState(entity: SettingsEntity): SettingsFormState |
| 1769 | SettingsViewModel.kt | `mapFormStateToEntity` | private fun mapFormStateToEntity(formState: SettingsFormState): SettingsEntity |
| 1770 | SettingsViewModel.kt | `refreshNtfyStatus` | fun refreshNtfyStatus() |
| 1771 | SettingsViewModel.kt | `refreshTailscaleStatus` | fun refreshTailscaleStatus() |
| 1772 | SettingsViewModel.kt | `regenerateHaWebhook` | fun regenerateHaWebhook() |
| 1773 | SettingsViewModel.kt | `resetSortOrders` | fun resetSortOrders() |
| 1774 | SettingsViewModel.kt | `sanitizeMapFields` | private fun sanitizeMapFields(formState: SettingsFormState): SettingsFormState |
| 1775 | SettingsViewModel.kt | `save` | fun save() |
| 1776 | SettingsViewModel.kt | `saveAndExit` | fun saveAndExit() |
| 1777 | SettingsViewModel.kt | `saveAndStay` | fun saveAndStay() |
| 1778 | SettingsViewModel.kt | `saveHaConfig` | fun saveHaConfig(baseUrl: String, accessToken: String, pollInterval: Int) |
| 1779 | SettingsViewModel.kt | `saveTailscaleConfig` | fun saveTailscaleConfig(authKey: String, enabled: Boolean) |
| 1780 | SettingsViewModel.kt | `setRawServerSettings` | fun setRawServerSettings(raw: Map<String, Any?>) |
| 1781 | SettingsViewModel.kt | `testEmailConnection` | fun testEmailConnection( |
| 1782 | SettingsViewModel.kt | `testHaConnection` | fun testHaConnection() |
| 1783 | SettingsViewModel.kt | `testNtfyNotification` | fun testNtfyNotification() |
| 1784 | SettingsViewModel.kt | `toggleBundle` | fun toggleBundle(bundleId: String, enable: Boolean) |
| 1785 | SettingsViewModel.kt | `triggerBackfill` | fun triggerBackfill() |
| 1786 | SettingsViewModel.kt | `updateSetting` | fun updateSetting(key: String, value: String) |
| 1787 | SettingsViewModel.kt | `validateBadgeDetectors` | private fun validateBadgeDetectors(detectorsJson: String): String? |
| 1788 | SettingsViewModel.kt | `validateSettings` | private fun validateSettings(formState: SettingsFormState): String? |
| 1789 | ViewsSettingsTab.kt | `BundleOmniToggles` | private fun BundleOmniToggles( |
| 1790 | ViewsSettingsTab.kt | `CalendarSection` | private fun CalendarSection( |
| 1791 | ViewsSettingsTab.kt | `ColorModeSelector` | private fun ColorModeSelector( |
| 1792 | ViewsSettingsTab.kt | `DefaultViewDropdown` | private fun DefaultViewDropdown( |
| 1793 | ViewsSettingsTab.kt | `EmailsToShowDropdown` | private fun EmailsToShowDropdown( |
| 1794 | ViewsSettingsTab.kt | `EnabledPeriodsSection` | private fun EnabledPeriodsSection( |
| 1795 | ViewsSettingsTab.kt | `HabitsSection` | private fun HabitsSection( |
| 1796 | ViewsSettingsTab.kt | `HourDropdown` | private fun HourDropdown( |
| 1797 | ViewsSettingsTab.kt | `HstBarClockSelector` | private fun HstBarClockSelector( |
| 1798 | ViewsSettingsTab.kt | `LockedFilterDefaults` | private fun LockedFilterDefaults( |
| 1799 | ViewsSettingsTab.kt | `MapsSection` | private fun MapsSection( |
| 1800 | ViewsSettingsTab.kt | `OmniViewSection` | private fun OmniViewSection( |
| 1801 | ViewsSettingsTab.kt | `ProjectsSection` | private fun ProjectsSection( |
| 1802 | ViewsSettingsTab.kt | `ScrollToHourDropdown` | private fun ScrollToHourDropdown( |
| 1803 | ViewsSettingsTab.kt | `ViewHoursSection` | private fun ViewHoursSection( |
| 1804 | ViewsSettingsTab.kt | `ViewOrderSection` | private fun ViewOrderSection( |
| 1805 | ViewsSettingsTab.kt | `ViewsSettingsTab` | fun ViewsSettingsTab( |
| 1806 | ViewsSettingsTab.kt | `WeekStartDayDropdown` | private fun WeekStartDayDropdown( |
| 1807 | ViewsSettingsTab.kt | `WorkDaysCheckboxes` | private fun WorkDaysCheckboxes( |
| 1808 | ViewsSettingsTab.kt | `WorkHoursSection` | private fun WorkHoursSection( |
| 1809 | ViewsSettingsTab.kt | `XDaysCountInput` | private fun XDaysCountInput( |
| 1810 | ViewsSettingsTab.kt | `jsonArrayToStringList` | private fun jsonArrayToStringList(arr: JSONArray?): List<String> |
| 1811 | ViewsSettingsTab.kt | `parseOmniLayout` | private fun parseOmniLayout(json: String): OmniLayout |
| 1812 | ViewsSettingsTab.kt | `serializeOmniLayout` | private fun serializeOmniLayout(layout: OmniLayout): String |

## ui/screens/settings/components/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1813 | CollapsibleSection.kt | `CollapsibleSection` | fun CollapsibleSection( |
| 1814 | CustomFilterModal.kt | `CustomFilterModal` | fun CustomFilterModal( |
| 1815 | CustomFilterModal.kt | `DisplayTogglesGroup` | private fun DisplayTogglesGroup( |
| 1816 | CustomFilterModal.kt | `FilterGroup` | private fun FilterGroup( |
| 1817 | CustomFilterModal.kt | `MultiSelectChipGroup` | private fun MultiSelectChipGroup( |
| 1818 | CustomFilterModal.kt | `ProjectSingleSelect` | private fun ProjectSingleSelect( |
| 1819 | CustomFilterModal.kt | `SortDirectionToggle` | private fun SortDirectionToggle( |
| 1820 | CustomFilterModal.kt | `SortFieldDropdown` | private fun SortFieldDropdown( |
| 1821 | CustomFilterModal.kt | `isDefaultFilter` | private fun isDefaultFilter(filter: CustomViewFilter): Boolean |
| 1822 | DragGrid.kt | `DragGrid` | fun DragGrid( |
| 1823 | DragGrid.kt | `DragGridItem` | private fun DragGridItem( |
| 1824 | DragGrid.kt | `DragZoneSection` | private fun DragZoneSection( |
| 1825 | DragGrid.kt | `handleDragEnd` | private fun handleDragEnd( |
| 1826 | DragGrid.kt | `isPointInRect` | private fun isPointInRect( |
| 1827 | OmniLayoutModal.kt | `EmptyZoneHint` | private fun EmptyZoneHint(text: String) |
| 1828 | OmniLayoutModal.kt | `OmniLayoutModal` | fun OmniLayoutModal( |
| 1829 | OmniLayoutModal.kt | `SectionCard` | private fun SectionCard( |
| 1830 | OmniLayoutModal.kt | `ZoneHeader` | private fun ZoneHeader(title: String, isUnused: Boolean = false) |
| 1831 | OmniLayoutModal.kt | `ZoneMoveButton` | private fun ZoneMoveButton( |
| 1832 | OmniLayoutModal.kt | `buildLayoutFromSections` | private fun buildLayoutFromSections(sections: List<ZonedSection>): OmniLayout |
| 1833 | OmniLayoutModal.kt | `getDefaultOmniLayout` | fun getDefaultOmniLayout(): OmniLayout |
| 1834 | OmniLayoutModal.kt | `moveToZone` | private fun moveToZone( |
| 1835 | OmniLayoutModal.kt | `moveWithinZone` | private fun moveWithinZone( |
| 1836 | SignatureEditorModal.kt | `SignatureEditorModal` | fun SignatureEditorModal( |
| 1837 | SignatureEditorModal.kt | `wrapSelection` | private fun wrapSelection( |
| 1838 | UpgradeModal.kt | `UpgradeModal` | fun UpgradeModal( |
| 1839 | UpgradeModal.kt | `startUpgrade` | fun startUpgrade() |

## ui/screens/tasks/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1840 | TasksScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState(onClearFilters: () -> Unit) |
| 1841 | TasksScreen.kt | `HabitCard` | private fun HabitCard(chit: ChitEntity, section: String, onClick: () -> Unit, onIncrement: () -> Unit |
| 1842 | TasksScreen.kt | `HabitIndicatorRow` | private fun HabitIndicatorRow( |
| 1843 | TasksScreen.kt | `HabitsView` | private fun HabitsView( |
| 1844 | TasksScreen.kt | `IndicatorIcons` | private fun IndicatorIcons(task: ChitEntity, textColor: Color, isSubChit: Boolean = false, currentUserId: String = "") |
| 1845 | TasksScreen.kt | `MetaChip` | private fun MetaChip(text: String, isSortActive: Boolean, sortDir: SortDirection, color: Color) |
| 1846 | TasksScreen.kt | `MetaValuesRow` | private fun MetaValuesRow(task: ChitEntity, sortState: SortState, textColor: Color) |
| 1847 | TasksScreen.kt | `NotePreview` | private fun NotePreview(note: String, expanded: Boolean, onToggle: () -> Unit, textColor: Color) |
| 1848 | TasksScreen.kt | `StatusDropdownRow` | private fun StatusDropdownRow( |
| 1849 | TasksScreen.kt | `TaskCard` | private fun TaskCard( |
| 1850 | TasksScreen.kt | `TasksEmptyState` | private fun TasksEmptyState() |
| 1851 | TasksScreen.kt | `TasksFlatList` | private fun TasksFlatList( |
| 1852 | TasksScreen.kt | `TasksLoadingSkeleton` | private fun TasksLoadingSkeleton() |
| 1853 | TasksScreen.kt | `TasksScreen` | fun TasksScreen( |
| 1854 | TasksScreen.kt | `formatResetPeriod` | private fun formatResetPeriod(resetPeriod: String?): String? |
| 1855 | TasksScreen.kt | `getResetEndDateFormatted` | private fun getResetEndDateFormatted(chit: ChitEntity): String? |
| 1856 | TasksScreen.kt | `habitUrgencyScore` | private fun habitUrgencyScore(chit: ChitEntity): Float |
| 1857 | TasksScreen.kt | `isResetPeriodActive` | private fun isResetPeriodActive(chit: ChitEntity): Boolean |
| 1858 | TasksScreen.kt | `parseResetPeriod` | private fun parseResetPeriod(resetPeriod: String): Pair<Int, String> |
| 1859 | TasksScreen.kt | `parseWeatherEmojiFromJson` | private fun parseWeatherEmojiFromJson(weatherJson: String?): String |
| 1860 | TasksScreen.kt | `priorityColor` | private fun priorityColor(priority: String): Color = when (priority) |
| 1861 | TasksScreen.kt | `sortArrow` | private fun sortArrow(dir: SortDirection): String = if (dir == SortDirection.ASC) " ▲" else " ▼" |
| 1862 | TasksScreen.kt | `statusColor` | private fun statusColor(status: String): Color = when (status) |
| 1863 | TasksScreen.kt | `statusIcon` | private fun statusIcon(status: String?): String = when (status) |
| 1864 | TasksScreen.kt | `statusWeight` | private fun statusWeight(status: String?): Int = when (status) |
| 1865 | TasksViewModel.kt | `finalizeDelete` | fun finalizeDelete(chitId: String? = null) |
| 1866 | TasksViewModel.kt | `softDelete` | fun softDelete(chitId: String) |
| 1867 | TasksViewModel.kt | `undoDelete` | fun undoDelete() |
| 1868 | TasksViewModel.kt | `updateRsvp` | fun updateRsvp(chitId: String, rsvpStatus: String) |

## ui/screens/trash/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1869 | TrashScreen.kt | `PurgeConfirmationDialog` | private fun PurgeConfirmationDialog( |
| 1870 | TrashScreen.kt | `TrashChitCard` | private fun TrashChitCard( |
| 1871 | TrashScreen.kt | `TrashEmptyState` | private fun TrashEmptyState(modifier: Modifier = Modifier) |
| 1872 | TrashScreen.kt | `TrashFilterChips` | private fun TrashFilterChips( |
| 1873 | TrashScreen.kt | `TrashList` | private fun TrashList( |
| 1874 | TrashScreen.kt | `TrashScreen` | fun TrashScreen( |
| 1875 | TrashScreen.kt | `buildChitTypeChips` | private fun buildChitTypeChips(chit: ChitEntity): List<String> |
| 1876 | TrashViewModel.kt | `bulkPurge` | fun bulkPurge() |
| 1877 | TrashViewModel.kt | `bulkRestore` | fun bulkRestore() |
| 1878 | TrashViewModel.kt | `deselectAll` | fun deselectAll() |
| 1879 | TrashViewModel.kt | `isAllSelected` | fun isAllSelected(chits: List<ChitEntity>): Boolean |
| 1880 | TrashViewModel.kt | `isSelected` | fun isSelected(chitId: String): Boolean = chitId in _selectedIds.value |
| 1881 | TrashViewModel.kt | `purge` | fun purge(chitId: String) |
| 1882 | TrashViewModel.kt | `restore` | fun restore(chitId: String) |
| 1883 | TrashViewModel.kt | `selectAll` | fun selectAll(chits: List<ChitEntity>) |
| 1884 | TrashViewModel.kt | `toggleSelectAll` | fun toggleSelectAll(chits: List<ChitEntity>) |
| 1885 | TrashViewModel.kt | `toggleSelection` | fun toggleSelection(chitId: String) |

## ui/screens/useradmin/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1886 | UserAdminScreen.kt | `CreateUserDialog` | private fun CreateUserDialog( |
| 1887 | UserAdminScreen.kt | `EditUserDialog` | private fun EditUserDialog( |
| 1888 | UserAdminScreen.kt | `EmptyState` | private fun EmptyState() |
| 1889 | UserAdminScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| 1890 | UserAdminScreen.kt | `LoadingState` | private fun LoadingState() |
| 1891 | UserAdminScreen.kt | `RoleBadge` | private fun RoleBadge(isAdmin: Boolean, isActive: Boolean) |
| 1892 | UserAdminScreen.kt | `UserAdminScreen` | fun UserAdminScreen( |
| 1893 | UserAdminScreen.kt | `UserCard` | private fun UserCard( |
| 1894 | UserAdminScreen.kt | `formatDate` | private fun formatDate(dateStr: String): String |
| 1895 | UserAdminViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| 1896 | UserAdminViewModel.kt | `createUser` | fun createUser( |
| 1897 | UserAdminViewModel.kt | `deactivateUser` | fun deactivateUser(userId: String) |
| 1898 | UserAdminViewModel.kt | `loadUsers` | fun loadUsers() |
| 1899 | UserAdminViewModel.kt | `reactivateUser` | fun reactivateUser(userId: String) |
| 1900 | UserAdminViewModel.kt | `resetPassword` | fun resetPassword(userId: String, newPassword: String) |
| 1901 | UserAdminViewModel.kt | `updateUser` | fun updateUser( |

## ui/screens/weather/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1902 | WeatherScreen.kt | `DailyForecastRow` | private fun DailyForecastRow(forecast: DailyForecast) |
| 1903 | WeatherScreen.kt | `LocationForecastCard` | private fun LocationForecastCard(location: LocationForecast) |
| 1904 | WeatherScreen.kt | `WeatherContent` | private fun WeatherContent(forecasts: List<LocationForecast>) |
| 1905 | WeatherScreen.kt | `WeatherEmptyState` | private fun WeatherEmptyState() |
| 1906 | WeatherScreen.kt | `WeatherErrorState` | private fun WeatherErrorState( |
| 1907 | WeatherScreen.kt | `WeatherLoadingState` | private fun WeatherLoadingState() |
| 1908 | WeatherScreen.kt | `WeatherScreen` | fun WeatherScreen( |
| 1909 | WeatherScreen.kt | `formatForecastDate` | private fun formatForecastDate(dateStr: String): String |
| 1910 | WeatherScreen.kt | `getDayOfWeek` | private fun getDayOfWeek(year: Int, month: Int, day: Int): Int |
| 1911 | WeatherScreen.kt | `getWeatherIcon` | private fun getWeatherIcon(code: Int?): String |
| 1912 | WeatherScreen.kt | `isDateToday` | private fun isDateToday(dateStr: String): Boolean |
| 1913 | WeatherViewModel.kt | `loadForecasts` | private fun loadForecasts() |
| 1914 | WeatherViewModel.kt | `mapResponseToForecasts` | private fun mapResponseToForecasts(response: WeatherForecastsResponse): List<LocationForecast> |
| 1915 | WeatherViewModel.kt | `refresh` | fun refresh() |
| 1916 | WeatherViewModel.kt | `weatherCodeToCondition` | private fun weatherCodeToCondition(code: Int?): String |

## ui/theme/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1917 | ColorUtils.kt | `applyContactRowColors` | fun applyContactRowColors(colorHex: String?): Pair<Color, Color>? |
| 1918 | ColorUtils.kt | `computeAutoContrast` | fun computeAutoContrast(backgroundColor: Color): Color |
| 1919 | ColorUtils.kt | `contactBorderColor` | fun contactBorderColor(colorHex: String?): Color? |
| 1920 | ColorUtils.kt | `parseHexColor` | fun parseHexColor(hex: String?): Color? |
| 1921 | ParchmentBackground.kt | `ParchmentBackground` | fun ParchmentBackground( |
| 1922 | Theme.kt | `CwocTheme` | fun CwocTheme( |

## ui/util/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1923 | DateUtils.kt | `formatDayOfWeek` | fun formatDayOfWeek(isoDatetime: String): String |
| 1924 | DateUtils.kt | `formatDisplayDate` | fun formatDisplayDate(isoDatetime: String): String |
| 1925 | DateUtils.kt | `formatDisplayDateTime` | fun formatDisplayDateTime(isoDatetime: String): String |
| 1926 | DateUtils.kt | `formatDisplayTime` | fun formatDisplayTime(isoDatetime: String): String |
| 1927 | DateUtils.kt | `formatShortDate` | fun formatShortDate(isoDatetime: String): String |
| 1928 | DateUtils.kt | `isPast` | fun isPast(isoDatetime: String): Boolean |
| 1929 | DateUtils.kt | `isToday` | fun isToday(isoDatetime: String): Boolean |
| 1930 | GeocodingUtil.kt | `clearCache` | fun clearCache() |
| 1931 | GeocodingUtil.kt | `geocode` | suspend fun geocode(address: String): GeoResult? |
| 1932 | MarkdownRenderer.kt | `AnnotatedString` | private fun AnnotatedString.Builder.appendInlineFormatted(text: String) |
| 1933 | MarkdownRenderer.kt | `renderToAnnotatedString` | fun renderToAnnotatedString(markdown: String): AnnotatedString |
| 1934 | UnitConverter.kt | `formatDistance` | fun formatDistance(km: Double, unitSystem: String): String |
| 1935 | UnitConverter.kt | `formatHeight` | fun formatHeight(cm: Double, unitSystem: String): String |
| 1936 | UnitConverter.kt | `formatSpeed` | fun formatSpeed(kmh: Double, unitSystem: String): String |
| 1937 | UnitConverter.kt | `formatTemperature` | fun formatTemperature(celsius: Double, unitSystem: String): String |
| 1938 | UnitConverter.kt | `formatWeight` | fun formatWeight(kg: Double, unitSystem: String): String |

## ui/viewmodel/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1939 | FilterSortViewModel.kt | `clearFilters` | fun clearFilters() |
| 1940 | FilterSortViewModel.kt | `getManualOrder` | fun getManualOrder(): List<String> |
| 1941 | FilterSortViewModel.kt | `loadSortPreference` | private fun loadSortPreference(tabRoute: String): SortState |
| 1942 | FilterSortViewModel.kt | `onTabChanged` | fun onTabChanged(tabRoute: String) |
| 1943 | FilterSortViewModel.kt | `persistSortPreference` | private fun persistSortPreference(tabRoute: String, sort: SortState) |
| 1944 | FilterSortViewModel.kt | `reorderItems` | fun reorderItems(currentIds: List<String>, fromIndex: Int, toIndex: Int) |
| 1945 | FilterSortViewModel.kt | `saveManualOrder` | fun saveManualOrder(ids: List<String>) |
| 1946 | FilterSortViewModel.kt | `updateFilter` | fun updateFilter(filter: FilterState) |
| 1947 | FilterSortViewModel.kt | `updateSort` | fun updateSort(sort: SortState) |
| 1948 | ProfileMenuViewModel.kt | `acceptNotification` | fun acceptNotification(notificationId: String) |
| 1949 | ProfileMenuViewModel.kt | `declineNotification` | fun declineNotification(notificationId: String) |
| 1950 | ProfileMenuViewModel.kt | `dismissNotification` | fun dismissNotification(notificationId: String) |
| 1951 | ProfileMenuViewModel.kt | `fetchNotifications` | fun fetchNotifications() |
| 1952 | ProfileMenuViewModel.kt | `removeFromList` | private fun removeFromList(notificationId: String) |
| 1953 | ProfileMenuViewModel.kt | `snoozeNotification` | fun snoozeNotification(notificationId: String) |
| 1954 | SidebarStateViewModel.kt | `deleteSearch` | fun deleteSearch(text: String) |
| 1955 | SidebarStateViewModel.kt | `goToToday` | fun goToToday() |
| 1956 | SidebarStateViewModel.kt | `nextPeriod` | fun nextPeriod() |
| 1957 | SidebarStateViewModel.kt | `persistSavedSearches` | private fun persistSavedSearches() |
| 1958 | SidebarStateViewModel.kt | `previousPeriod` | fun previousPeriod() |
| 1959 | SidebarStateViewModel.kt | `restoreFromPrefs` | private fun restoreFromPrefs() |
| 1960 | SidebarStateViewModel.kt | `saveSearch` | fun saveSearch(text: String) |
| 1961 | SidebarStateViewModel.kt | `setAlarmsViewMode` | fun setAlarmsViewMode(mode: String) |
| 1962 | SidebarStateViewModel.kt | `setEmailFolder` | fun setEmailFolder(folder: String) |
| 1963 | SidebarStateViewModel.kt | `setHabitsIncludeRules` | fun setHabitsIncludeRules(include: Boolean) |
| 1964 | SidebarStateViewModel.kt | `setHabitsSuccessWindow` | fun setHabitsSuccessWindow(window: Int) |
| 1965 | SidebarStateViewModel.kt | `setIndicatorsCustomRange` | fun setIndicatorsCustomRange(start: String?, end: String?) |
| 1966 | SidebarStateViewModel.kt | `setIndicatorsRange` | fun setIndicatorsRange(range: String) |
| 1967 | SidebarStateViewModel.kt | `setIndicatorsVisibleGraphs` | fun setIndicatorsVisibleGraphs(graphs: Set<String>) |
| 1968 | SidebarStateViewModel.kt | `setMonthMode` | fun setMonthMode(mode: String) |
| 1969 | SidebarStateViewModel.kt | `setPeriod` | fun setPeriod(period: String) |
| 1970 | SidebarStateViewModel.kt | `setProjectsViewMode` | fun setProjectsViewMode(mode: String) |
| 1971 | SidebarStateViewModel.kt | `setSearchText` | fun setSearchText(text: String) |
| 1972 | SidebarStateViewModel.kt | `setTasksViewMode` | fun setTasksViewMode(mode: String) |
| 1973 | SidebarStateViewModel.kt | `updateDateDisplay` | private fun updateDateDisplay() |

## widget/calendar/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1974 | TodayCalendarWidgetProvider.kt | `onUpdate` | override fun onUpdate( |

## widget/quickadd/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1975 | QuickAddWidgetProvider.kt | `onUpdate` | override fun onUpdate( |

## widget/refresh/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1976 | WidgetDataProvider.kt | `getDatabase` | private fun getDatabase(context: Context): CwocDatabase |
| 1977 | WidgetDataProvider.kt | `getTodayCalendarChits` | suspend fun getTodayCalendarChits(context: Context): List<WidgetCalendarItem> |
| 1978 | WidgetDataProvider.kt | `getUpcomingTasks` | suspend fun getUpcomingTasks(context: Context): List<WidgetTaskItem> |
| 1979 | WidgetUpdateWorker.kt | `refreshAllWidgets` | private fun refreshAllWidgets(context: Context) |
| 1980 | WidgetUpdateWorker.kt | `refreshNow` | fun refreshNow(context: Context) |
| 1981 | WidgetUpdateWorker.kt | `schedulePeriodic` | fun schedulePeriodic(context: Context) |

## widget/tasks/

| # | File | Function | Signature |
|-----|------|----------|----------|
| 1982 | UpcomingTasksWidgetProvider.kt | `onUpdate` | override fun onUpdate( |

