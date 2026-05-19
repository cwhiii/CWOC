# CWOC Android App — Complete Function Index

> Every function in the Android app source code.
> Total: 1982 functions across 269 files.

---

## (root)/

| File | Function | Signature |
|------|----------|----------|
| CwocApplication.kt | `onCreate` | override fun onCreate() |
| MainActivity.kt | `CwocApp` | private fun CwocApp( |
| MainActivity.kt | `onCreate` | override fun onCreate(savedInstanceState: Bundle?) |

## data/attachment/

| File | Function | Signature |
|------|----------|----------|
| AttachmentCache.kt | `evictIfNeeded` | suspend fun evictIfNeeded() |
| AttachmentCache.kt | `get` | suspend fun get(attachmentId: String): File? |
| AttachmentCache.kt | `getTotalSize` | suspend fun getTotalSize(): Long |
| AttachmentCache.kt | `put` | suspend fun put(attachmentId: String, data: ByteArray) |
| AttachmentCache.kt | `remove` | suspend fun remove(attachmentId: String) |
| AttachmentManager.kt | `downloadAttachment` | suspend fun downloadAttachment(attachmentId: String, url: String): Result<File> |
| AttachmentManager.kt | `getCachedFile` | suspend fun getCachedFile(attachmentId: String): File? |
| AttachmentManager.kt | `getDownloadState` | fun getDownloadState(attachmentId: String): StateFlow<DownloadState> |
| AttachmentManager.kt | `getOrCreateStateFlow` | private fun getOrCreateStateFlow(attachmentId: String): MutableStateFlow<DownloadState> |
| AttachmentManager.kt | `uploadAttachment` | suspend fun uploadAttachment( |
| AttachmentManager.kt | `uploadPendingAttachments` | suspend fun uploadPendingAttachments() |

## data/local/

| File | Function | Signature |
|------|----------|----------|
| CwocDatabase.kt | `attachmentMetadataDao` | abstract fun attachmentMetadataDao(): AttachmentMetadataDao |
| CwocDatabase.kt | `chitDao` | abstract fun chitDao(): ChitDao |
| CwocDatabase.kt | `contactDao` | abstract fun contactDao(): ContactDao |
| CwocDatabase.kt | `notificationDao` | abstract fun notificationDao(): NotificationDao |
| CwocDatabase.kt | `settingsDao` | abstract fun settingsDao(): SettingsDao |
| CwocDatabase.kt | `standaloneAlertDao` | abstract fun standaloneAlertDao(): StandaloneAlertDao |
| CwocDatabase.kt | `syncMetadataDao` | abstract fun syncMetadataDao(): SyncMetadataDao |

## data/local/converter/

| File | Function | Signature |
|------|----------|----------|
| Converters.kt | `fromStringList` | fun fromStringList(value: List<String>?): String? |
| Converters.kt | `toStringList` | fun toStringList(value: String?): List<String>? |

## data/local/dao/

| File | Function | Signature |
|------|----------|----------|
| AttachmentMetadataDao.kt | `clearLocalPath` | suspend fun clearLocalPath(id: String) |
| AttachmentMetadataDao.kt | `getAllCachedSortedByAccess` | suspend fun getAllCachedSortedByAccess(): List<AttachmentMetadata> |
| AttachmentMetadataDao.kt | `getByChitId` | suspend fun getByChitId(chitId: String): List<AttachmentMetadata> |
| AttachmentMetadataDao.kt | `getById` | suspend fun getById(id: String): AttachmentMetadata? |
| AttachmentMetadataDao.kt | `getByUrl` | suspend fun getByUrl(url: String): AttachmentMetadata? |
| AttachmentMetadataDao.kt | `getPendingUploads` | suspend fun getPendingUploads(): List<AttachmentMetadata> |
| AttachmentMetadataDao.kt | `insert` | suspend fun insert(attachment: AttachmentMetadata) |
| AttachmentMetadataDao.kt | `updateAfterUpload` | suspend fun updateAfterUpload(id: String, url: String) |
| AttachmentMetadataDao.kt | `updateLastAccessed` | suspend fun updateLastAccessed(id: String, timestamp: String) |
| AttachmentMetadataDao.kt | `updateLocalPath` | suspend fun updateLocalPath(id: String, localPath: String?) |
| ChitDao.kt | `clearConflictFlag` | suspend fun clearConflictFlag(id: String) |
| ChitDao.kt | `getAlertChits` | fun getAlertChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getAllNonDeleted` | fun getAllNonDeleted(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getAllNonDeletedSnapshot` | suspend fun getAllNonDeletedSnapshot(): List<ChitEntity> |
| ChitDao.kt | `getById` | suspend fun getById(id: String): ChitEntity? |
| ChitDao.kt | `getCalendarChits` | fun getCalendarChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getChecklistChits` | fun getChecklistChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getChitsByIds` | suspend fun getChitsByIds(ids: List<String>): List<ChitEntity> |
| ChitDao.kt | `getChitsForDay` | fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> |
| ChitDao.kt | `getChitsForDaySuspend` | suspend fun getChitsForDaySuspend(dayStart: String, dayEnd: String): List<ChitEntity> |
| ChitDao.kt | `getChitsWithAlerts` | suspend fun getChitsWithAlerts(): List<ChitEntity> |
| ChitDao.kt | `getChitsWithTag` | suspend fun getChitsWithTag(tag: String): List<ChitEntity> |
| ChitDao.kt | `getCount` | suspend fun getCount(): Int |
| ChitDao.kt | `getDeletedChits` | fun getDeletedChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getDirtyChits` | suspend fun getDirtyChits(): List<ChitEntity> |
| ChitDao.kt | `getDirtyCount` | suspend fun getDirtyCount(): Int |
| ChitDao.kt | `getFirstFive` | suspend fun getFirstFive(): List<ChitEntity> |
| ChitDao.kt | `getIndicatorChits` | fun getIndicatorChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getLocationChits` | fun getLocationChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getNoteChits` | fun getNoteChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getProjectMasterChits` | fun getProjectMasterChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getRecurringChits` | fun getRecurringChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getTaskChits` | fun getTaskChits(): Flow<List<ChitEntity>> |
| ChitDao.kt | `getTasksByStatus` | fun getTasksByStatus(status: String): Flow<List<ChitEntity>> |
| ChitDao.kt | `getUpcomingTasksSuspend` | suspend fun getUpcomingTasksSuspend(): List<ChitEntity> |
| ChitDao.kt | `hardDelete` | suspend fun hardDelete(id: String) |
| ChitDao.kt | `markDeleted` | suspend fun markDeleted(id: String, now: String) |
| ChitDao.kt | `markDirty` | suspend fun markDirty(id: String, dirtyFields: String, now: String) |
| ChitDao.kt | `restoreDeleted` | suspend fun restoreDeleted(id: String, now: String) |
| ChitDao.kt | `setConflictState` | suspend fun setConflictState(id: String, fields: String) |
| ChitDao.kt | `updateDirtyState` | suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) |
| ChitDao.kt | `updateSyncVersion` | suspend fun updateSyncVersion(id: String, version: Int) |
| ChitDao.kt | `upsert` | suspend fun upsert(chit: ChitEntity) |
| ChitDao.kt | `upsertAll` | suspend fun upsertAll(chits: List<ChitEntity>) |
| ChitDao.kt | `upsertWithoutDirty` | suspend fun upsertWithoutDirty(chit: ChitEntity) |
| ContactDao.kt | `getAllActive` | fun getAllActive(): Flow<List<ContactEntity>> |
| ContactDao.kt | `getAllContacts` | fun getAllContacts(): Flow<List<ContactEntity>> |
| ContactDao.kt | `getById` | suspend fun getById(id: String): ContactEntity? |
| ContactDao.kt | `getDeletedContacts` | fun getDeletedContacts(): Flow<List<ContactEntity>> |
| ContactDao.kt | `getDirtyContacts` | suspend fun getDirtyContacts(): List<ContactEntity> |
| ContactDao.kt | `getFavoriteState` | suspend fun getFavoriteState(id: String): Boolean? |
| ContactDao.kt | `getFavorites` | fun getFavorites(): Flow<List<ContactEntity>> |
| ContactDao.kt | `getNonFavoriteOwned` | fun getNonFavoriteOwned(): Flow<List<ContactEntity>> |
| ContactDao.kt | `getVaultContacts` | fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>> |
| ContactDao.kt | `markDeleted` | suspend fun markDeleted(id: String, now: String) |
| ContactDao.kt | `purge` | suspend fun purge(id: String) |
| ContactDao.kt | `restoreFromTrash` | suspend fun restoreFromTrash(id: String, now: String) |
| ContactDao.kt | `search` | fun search(query: String): Flow<List<ContactEntity>> |
| ContactDao.kt | `searchAll` | fun searchAll(query: String): Flow<List<ContactEntity>> |
| ContactDao.kt | `setConflictState` | suspend fun setConflictState(id: String, fields: String) |
| ContactDao.kt | `toggleFavorite` | suspend fun toggleFavorite(id: String, now: String) |
| ContactDao.kt | `updateDirtyState` | suspend fun updateDirtyState(id: String, isDirty: Boolean, dirtyFields: String) |
| ContactDao.kt | `updateSyncVersion` | suspend fun updateSyncVersion(id: String, version: Int) |
| ContactDao.kt | `upsert` | suspend fun upsert(contact: ContactEntity) |
| ContactDao.kt | `upsertAll` | suspend fun upsertAll(contacts: List<ContactEntity>) |
| NotificationDao.kt | `deleteAll` | suspend fun deleteAll() |
| NotificationDao.kt | `dismiss` | suspend fun dismiss(id: String) |
| NotificationDao.kt | `getAll` | fun getAll(): Flow<List<NotificationEntity>> |
| NotificationDao.kt | `getUnreadCount` | fun getUnreadCount(): Flow<Int> |
| NotificationDao.kt | `insert` | suspend fun insert(notification: NotificationEntity) |
| NotificationDao.kt | `insertAll` | suspend fun insertAll(notifications: List<NotificationEntity>) |
| NotificationDao.kt | `markRead` | suspend fun markRead(id: String) |
| NotificationDao.kt | `updateAction` | suspend fun updateAction(id: String, action: String) |
| SettingsDao.kt | `clearDirty` | suspend fun clearDirty() |
| SettingsDao.kt | `get` | suspend fun get(): SettingsEntity? |
| SettingsDao.kt | `getSettings` | fun getSettings(): Flow<SettingsEntity?> |
| SettingsDao.kt | `getSettingsOnce` | suspend fun getSettingsOnce(): SettingsEntity? |
| SettingsDao.kt | `markDirty` | suspend fun markDirty() |
| SettingsDao.kt | `replace` | suspend fun replace(settings: SettingsEntity) |
| SettingsDao.kt | `update` | suspend fun update(settings: SettingsEntity) |
| SettingsDao.kt | `updateSyncVersion` | suspend fun updateSyncVersion(version: Int) |
| SettingsDao.kt | `upsert` | suspend fun upsert(settings: SettingsEntity) |
| StandaloneAlertDao.kt | `deleteAll` | suspend fun deleteAll() |
| StandaloneAlertDao.kt | `deleteById` | suspend fun deleteById(id: String) |
| StandaloneAlertDao.kt | `getAll` | fun getAll(): Flow<List<StandaloneAlertEntity>> |
| StandaloneAlertDao.kt | `getByType` | fun getByType(type: String): Flow<List<StandaloneAlertEntity>> |
| StandaloneAlertDao.kt | `insert` | suspend fun insert(entity: StandaloneAlertEntity) |
| StandaloneAlertDao.kt | `insertAll` | suspend fun insertAll(entities: List<StandaloneAlertEntity>) |
| StandaloneAlertDao.kt | `update` | suspend fun update(entity: StandaloneAlertEntity) |
| SyncMetadataDao.kt | `getMetadata` | suspend fun getMetadata(): SyncMetadataEntity? |
| SyncMetadataDao.kt | `updateHighWaterMark` | suspend fun updateHighWaterMark(version: Int, timestamp: String) |
| SyncMetadataDao.kt | `updateSyncStatus` | suspend fun updateSyncStatus(status: String) |
| SyncMetadataDao.kt | `upsert` | suspend fun upsert(metadata: SyncMetadataEntity) |

## data/local/migration/

| File | Function | Signature |
|------|----------|----------|
| Migration1To2.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration2To3.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration3To4.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration4To5.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration5To6.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration6To7.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration7To8.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |
| Migration8To9.kt | `migrate` | override fun migrate(database: SupportSQLiteDatabase) |

## data/mapper/

| File | Function | Signature |
|------|----------|----------|
| ChitMapper.kt | `ChitEntity` | fun ChitEntity.toFormState(): ChitFormState |
| ChitMapper.kt | `ChitFormState` | fun ChitFormState.toEntity( |
| ChitMapper.kt | `detectChangedFields` | fun detectChangedFields(original: ChitEntity?, form: ChitFormState): Set<String> |
| ContactImageManager.kt | `createTempCameraFile` | fun createTempCameraFile(context: Context): Pair<File, Uri>? |
| ContactImageManager.kt | `fileToBytes` | fun fileToBytes(file: File): ByteArray = file.readBytes() |
| ContactImageManager.kt | `getMimeType` | fun getMimeType(file: File): String |
| ContactImageManager.kt | `isGif` | fun isGif(context: Context, uri: Uri): Boolean |
| ContactImageManager.kt | `resizeBitmap` | fun resizeBitmap(context: Context, bitmap: Bitmap, maxSize: Int = MAX_IMAGE_SIZE): File? |
| ContactImageManager.kt | `resizeImage` | fun resizeImage(context: Context, uri: Uri, maxSize: Int = MAX_IMAGE_SIZE): File? |
| ContactMapper.kt | `ContactEntity` | fun ContactEntity.toContactFormState(): ContactFormState |
| ContactMapper.kt | `ContactFormState` | fun ContactFormState.toContactEntity( |
| ContactMapper.kt | `detectContactChangedFields` | fun detectContactChangedFields(original: ContactEntity?, form: ContactFormState): Set<String> |
| ContactPushMapper.kt | `ContactEntity` | fun ContactEntity.toPushDto(): ContactPushDto |
| ContactPushMapper.kt | `parseDirtyFieldsList` | private fun parseDirtyFieldsList(json: String?): List<String>? |
| SettingsPayloadMapper.kt | `Map` | private fun Map<String, Any?>.getString(key: String): String? |
| SettingsPayloadMapper.kt | `mapFormStateToPayload` | fun mapFormStateToPayload(formState: SettingsFormState): Map<String, Any?> |
| SettingsPayloadMapper.kt | `mapPayloadToFormState` | fun mapPayloadToFormState(payload: Map<String, Any?>): SettingsFormState |
| SettingsPayloadMapper.kt | `mergePayload` | fun mergePayload( |
| SettingsPayloadMapper.kt | `parseJsonOrRaw` | private fun parseJsonOrRaw(jsonString: String): Any? |
| SettingsPushMapper.kt | `SettingsEntity` | fun SettingsEntity.toPushDto(): SettingsPushDto |
| VCardBuilder.kt | `addMultiValue` | private fun addMultiValue(lines: MutableList<String>, prop: String, json: String?) |
| VCardBuilder.kt | `build` | fun build(contact: ContactEntity): String |
| VCardBuilder.kt | `byteSize` | fun byteSize(vcard: String): Int = vcard.toByteArray(Charsets.UTF_8).size |
| VCardBuilder.kt | `fitsInQr` | fun fitsInQr(vcard: String): Boolean = byteSize(vcard) <= MAX_QR_BYTES |
| VCardBuilder.kt | `parseMultiValue` | private fun parseMultiValue(json: String?): List<Map<String, Any?>>? |

## data/remote/

| File | Function | Signature |
|------|----------|----------|
| AuthInterceptor.kt | `intercept` | override fun intercept(chain: Interceptor.Chain): Response |
| CwocApiService.kt | `archiveOriginal` | suspend fun archiveOriginal( |
| CwocApiService.kt | `authenticate` | suspend fun authenticate( |
| CwocApiService.kt | `connectTailscale` | suspend fun connectTailscale(): Response<TailscaleConnectResponse> |
| CwocApiService.kt | `createBundle` | suspend fun createBundle( |
| CwocApiService.kt | `createStandaloneAlert` | suspend fun createStandaloneAlert( |
| CwocApiService.kt | `deleteAttachment` | suspend fun deleteAttachment( |
| CwocApiService.kt | `deleteBundle` | suspend fun deleteBundle( |
| CwocApiService.kt | `deleteContactImage` | suspend fun deleteContactImage( |
| CwocApiService.kt | `deleteStandaloneAlert` | suspend fun deleteStandaloneAlert( |
| CwocApiService.kt | `disableBundle` | suspend fun disableBundle( |
| CwocApiService.kt | `disableNtfy` | suspend fun disableNtfy(): Response<NtfyToggleResponse> |
| CwocApiService.kt | `disconnectTailscale` | suspend fun disconnectTailscale(): Response<TailscaleDisconnectResponse> |
| CwocApiService.kt | `dismissConflict` | suspend fun dismissConflict( |
| CwocApiService.kt | `dismissNotification` | suspend fun dismissNotification( |
| CwocApiService.kt | `downloadAttachment` | suspend fun downloadAttachment( |
| CwocApiService.kt | `downloadRawEmail` | suspend fun downloadRawEmail( |
| CwocApiService.kt | `emailBackfillEstimate` | suspend fun emailBackfillEstimate(): Response<EmailBackfillEstimateResponse> |
| CwocApiService.kt | `emailSync` | suspend fun emailSync( |
| CwocApiService.kt | `enableBundle` | suspend fun enableBundle( |
| CwocApiService.kt | `enableNtfy` | suspend fun enableNtfy(): Response<NtfyToggleResponse> |
| CwocApiService.kt | `exportAll` | suspend fun exportAll(): Response<ResponseBody> |
| CwocApiService.kt | `exportChits` | suspend fun exportChits(): Response<ResponseBody> |
| CwocApiService.kt | `exportContacts` | suspend fun exportContacts( |
| CwocApiService.kt | `exportSingleContact` | suspend fun exportSingleContact( |
| CwocApiService.kt | `exportUsers` | suspend fun exportUsers(): Response<ResponseBody> |
| CwocApiService.kt | `getBundles` | suspend fun getBundles(): Response<BundlesResponse> |
| CwocApiService.kt | `getContactBirthdays` | suspend fun getContactBirthdays(): Response<List<Map<String, Any?>>> |
| CwocApiService.kt | `getCustomObjectsForZone` | suspend fun getCustomObjectsForZone( |
| CwocApiService.kt | `getDiskUsage` | suspend fun getDiskUsage(): Response<DiskUsageResponse> |
| CwocApiService.kt | `getDocContent` | suspend fun getDocContent( |
| CwocApiService.kt | `getDocsIndex` | suspend fun getDocsIndex(): Response<DocsIndexResponse> |
| CwocApiService.kt | `getHaConfig` | suspend fun getHaConfig(): Response<HaConfigResponse> |
| CwocApiService.kt | `getLoginMessage` | suspend fun getLoginMessage(): Response<LoginMessageResponse> |
| CwocApiService.kt | `getMe` | suspend fun getMe(): Response<UserProfileResponse> |
| CwocApiService.kt | `getNotifications` | suspend fun getNotifications( |
| CwocApiService.kt | `getNtfyStatus` | suspend fun getNtfyStatus(): Response<NtfyStatusResponse> |
| CwocApiService.kt | `getPrivatePgpKey` | suspend fun getPrivatePgpKey( |
| CwocApiService.kt | `getReleaseNotes` | suspend fun getReleaseNotes(): Response<ReleaseNotesResponse> |
| CwocApiService.kt | `getSettings` | suspend fun getSettings( |
| CwocApiService.kt | `getSortOrders` | suspend fun getSortOrders(): Response<Map<String, List<String>>> |
| CwocApiService.kt | `getSortPreferences` | suspend fun getSortPreferences(): Response<Map<String, Map<String, String>>> |
| CwocApiService.kt | `getStandaloneAlerts` | suspend fun getStandaloneAlerts(): Response<List<StandaloneAlertDto>> |
| CwocApiService.kt | `getSwitchableUsers` | suspend fun getSwitchableUsers(): Response<List<SwitchableUserDto>> |
| CwocApiService.kt | `getSyncChanges` | suspend fun getSyncChanges( |
| CwocApiService.kt | `getTailscaleStatus` | suspend fun getTailscaleStatus(): Response<TailscaleStatusResponse> |
| CwocApiService.kt | `getTrashContacts` | suspend fun getTrashContacts(): Response<List<Map<String, Any?>>> |
| CwocApiService.kt | `getUpdateLog` | suspend fun getUpdateLog(): Response<UpdateLogResponse> |
| CwocApiService.kt | `getVersion` | suspend fun getVersion(): Response<VersionResponse> |
| CwocApiService.kt | `getWeatherForecasts` | suspend fun getWeatherForecasts(): Response<com.cwoc.app.ui.screens.weather.WeatherForecastsResponse> |
| CwocApiService.kt | `importAll` | suspend fun importAll( |
| CwocApiService.kt | `importChits` | suspend fun importChits( |
| CwocApiService.kt | `importContacts` | suspend fun importContacts( |
| CwocApiService.kt | `importUserdata` | suspend fun importUserdata( |
| CwocApiService.kt | `markEmailRead` | suspend fun markEmailRead( |
| CwocApiService.kt | `patchChecklist` | suspend fun patchChecklist( |
| CwocApiService.kt | `patchRsvp` | suspend fun patchRsvp( |
| CwocApiService.kt | `postClientLog` | suspend fun postClientLog( |
| CwocApiService.kt | `purgeContact` | suspend fun purgeContact( |
| CwocApiService.kt | `pushChanges` | suspend fun pushChanges( |
| CwocApiService.kt | `regenerateHaWebhook` | suspend fun regenerateHaWebhook(): Response<HaWebhookRegenerateResponse> |
| CwocApiService.kt | `reorderBundles` | suspend fun reorderBundles( |
| CwocApiService.kt | `resetSortOrders` | suspend fun resetSortOrders(): Response<ResetSortOrdersResponse> |
| CwocApiService.kt | `restartService` | suspend fun restartService(): Response<RestartResponse> |
| CwocApiService.kt | `restoreContact` | suspend fun restoreContact( |
| CwocApiService.kt | `saveHaConfig` | suspend fun saveHaConfig( |
| CwocApiService.kt | `saveSettings` | suspend fun saveSettings( |
| CwocApiService.kt | `saveSortOrder` | suspend fun saveSortOrder( |
| CwocApiService.kt | `saveSortPreference` | suspend fun saveSortPreference( |
| CwocApiService.kt | `saveTailscaleConfig` | suspend fun saveTailscaleConfig( |
| CwocApiService.kt | `scheduleEmail` | suspend fun scheduleEmail( |
| CwocApiService.kt | `sendEmail` | suspend fun sendEmail( |
| CwocApiService.kt | `snoozeNotification` | suspend fun snoozeNotification( |
| CwocApiService.kt | `streamUpgrade` | suspend fun streamUpgrade(): Response<ResponseBody> |
| CwocApiService.kt | `testEmailConnection` | suspend fun testEmailConnection( |
| CwocApiService.kt | `testHaConnection` | suspend fun testHaConnection(): Response<HaTestResponse> |
| CwocApiService.kt | `testNtfy` | suspend fun testNtfy(): Response<NtfyTestResponse> |
| CwocApiService.kt | `toggleContactFavorite` | suspend fun toggleContactFavorite( |
| CwocApiService.kt | `updateBundle` | suspend fun updateBundle( |
| CwocApiService.kt | `updateNotification` | suspend fun updateNotification( |
| CwocApiService.kt | `updateStandaloneAlert` | suspend fun updateStandaloneAlert( |
| CwocApiService.kt | `uploadAttachment` | suspend fun uploadAttachment( |
| CwocApiService.kt | `uploadContactImage` | suspend fun uploadContactImage( |
| TokenAuthenticator.kt | `authenticate` | override fun authenticate(route: Route?, response: Response): Request? |
| TokenAuthenticator.kt | `reset` | fun reset() |

## data/repository/

| File | Function | Signature |
|------|----------|----------|
| AuthEventEmitter.kt | `emitTokenRevokedSync` | fun emitTokenRevokedSync() |
| AuthRepository.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| AuthRepository.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| AuthRepository.kt | `clearToken` | fun clearToken() |
| AuthRepository.kt | `emitTokenRevoked` | suspend fun emitTokenRevoked() |
| AuthRepository.kt | `emitTokenRevokedSync` | override fun emitTokenRevokedSync() |
| AuthRepository.kt | `fetchUserProfile` | suspend fun fetchUserProfile() |
| AuthRepository.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf() |
| AuthRepository.kt | `getLastServerUrl` | fun getLastServerUrl(): String? |
| AuthRepository.kt | `isAuthenticated` | fun isAuthenticated(): Boolean |
| AuthRepository.kt | `login` | suspend fun login(serverUrl: String, username: String, password: String): AuthResult |
| BundleRepository.kt | `createBundle` | suspend fun createBundle( |
| BundleRepository.kt | `deleteBundle` | suspend fun deleteBundle(id: String): Result<Unit> |
| BundleRepository.kt | `disableBundle` | suspend fun disableBundle(id: String): Result<Unit> |
| BundleRepository.kt | `enableBundle` | suspend fun enableBundle(id: String): Result<Unit> |
| BundleRepository.kt | `fetchBundles` | suspend fun fetchBundles(): Result<List<BundleDto>> |
| BundleRepository.kt | `reorderBundles` | suspend fun reorderBundles(orderedIds: List<String>): Result<Unit> |
| BundleRepository.kt | `updateBundle` | suspend fun updateBundle( |
| ChitRepository.kt | `archive` | suspend fun archive(chitId: String) |
| ChitRepository.kt | `decrementHabitSuccess` | suspend fun decrementHabitSuccess(chitId: String) |
| ChitRepository.kt | `getAlertChits` | fun getAlertChits(): Flow<List<ChitEntity>> = chitDao.getAlertChits() |
| ChitRepository.kt | `getAllNonDeleted` | fun getAllNonDeleted(): Flow<List<ChitEntity>> = chitDao.getAllNonDeleted() |
| ChitRepository.kt | `getById` | suspend fun getById(id: String): ChitEntity? = chitDao.getById(id) |
| ChitRepository.kt | `getCalendarChits` | fun getCalendarChits(): Flow<List<ChitEntity>> = chitDao.getCalendarChits() |
| ChitRepository.kt | `getChecklistChits` | fun getChecklistChits(): Flow<List<ChitEntity>> = chitDao.getChecklistChits() |
| ChitRepository.kt | `getChitsByIds` | suspend fun getChitsByIds(ids: List<String>): List<ChitEntity> = chitDao.getChitsByIds(ids) |
| ChitRepository.kt | `getChitsForDay` | fun getChitsForDay(dayStart: String, dayEnd: String): Flow<List<ChitEntity>> |
| ChitRepository.kt | `getCount` | suspend fun getCount(): Int = chitDao.getCount() |
| ChitRepository.kt | `getDeletedChits` | fun getDeletedChits(): Flow<List<ChitEntity>> = chitDao.getDeletedChits() |
| ChitRepository.kt | `getIndicatorChits` | fun getIndicatorChits(): Flow<List<ChitEntity>> = chitDao.getIndicatorChits() |
| ChitRepository.kt | `getLocationChits` | fun getLocationChits(): Flow<List<ChitEntity>> = chitDao.getLocationChits() |
| ChitRepository.kt | `getNoteChits` | fun getNoteChits(): Flow<List<ChitEntity>> = chitDao.getNoteChits() |
| ChitRepository.kt | `getProjectMasterChits` | fun getProjectMasterChits(): Flow<List<ChitEntity>> = chitDao.getProjectMasterChits() |
| ChitRepository.kt | `getRecurringChits` | fun getRecurringChits(): Flow<List<ChitEntity>> |
| ChitRepository.kt | `getTaskChits` | fun getTaskChits(): Flow<List<ChitEntity>> = chitDao.getTaskChits() |
| ChitRepository.kt | `getTasksByStatus` | fun getTasksByStatus(status: String): Flow<List<ChitEntity>> = chitDao.getTasksByStatus(status) |
| ChitRepository.kt | `incrementHabitSuccess` | suspend fun incrementHabitSuccess(chitId: String) |
| ChitRepository.kt | `markDirty` | suspend fun markDirty(id: String, field: String) |
| ChitRepository.kt | `pin` | suspend fun pin(chitId: String) |
| ChitRepository.kt | `snooze` | suspend fun snooze(chitId: String, until: String) |
| ChitRepository.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline(chitId: String) |
| ChitRepository.kt | `unarchive` | suspend fun unarchive(chitId: String) |
| ChitRepository.kt | `unpin` | suspend fun unpin(chitId: String) |
| ChitRepository.kt | `unsnooze` | suspend fun unsnooze(chitId: String) |
| ChitRepository.kt | `updateDateTimes` | suspend fun updateDateTimes( |
| ChitRepository.kt | `updateRsvp` | suspend fun updateRsvp(chitId: String, rsvpStatus: String): Boolean |
| ChitRepository.kt | `updateStatus` | suspend fun updateStatus(chitId: String, newStatus: String) |
| ChitRepository.kt | `updateTitleAndNote` | suspend fun updateTitleAndNote(chitId: String, title: String, note: String) |
| ContactRepository.kt | `create` | suspend fun create(contact: ContactEntity) |
| ContactRepository.kt | `delete` | suspend fun delete(contactId: String) |
| ContactRepository.kt | `deleteImage` | suspend fun deleteImage(contactId: String) |
| ContactRepository.kt | `exportAll` | suspend fun exportAll(context: Context, format: String): File? |
| ContactRepository.kt | `exportSingle` | suspend fun exportSingle(context: Context, contactId: String): File? |
| ContactRepository.kt | `getById` | suspend fun getById(id: String): ContactEntity? |
| ContactRepository.kt | `getFavorites` | fun getFavorites(): Flow<List<ContactEntity>> |
| ContactRepository.kt | `getNonFavoriteOwned` | fun getNonFavoriteOwned(): Flow<List<ContactEntity>> |
| ContactRepository.kt | `getSwitchableUsers` | suspend fun getSwitchableUsers(): List<SwitchableUserDto> |
| ContactRepository.kt | `getTrashContacts` | fun getTrashContacts(): Flow<List<ContactEntity>> |
| ContactRepository.kt | `getVaultContacts` | fun getVaultContacts(currentUserId: String): Flow<List<ContactEntity>> |
| ContactRepository.kt | `importFile` | suspend fun importFile(context: Context, uri: Uri, filename: String): ImportResultDto? |
| ContactRepository.kt | `purgeFromTrash` | suspend fun purgeFromTrash(contactId: String) |
| ContactRepository.kt | `restoreFromTrash` | suspend fun restoreFromTrash(contactId: String) |
| ContactRepository.kt | `searchContacts` | fun searchContacts(query: String): Flow<List<ContactEntity>> |
| ContactRepository.kt | `toggleFavorite` | suspend fun toggleFavorite(contactId: String): Boolean |
| ContactRepository.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline() |
| ContactRepository.kt | `update` | suspend fun update(contact: ContactEntity, changedFields: Set<String>) |
| ContactRepository.kt | `uploadImage` | suspend fun uploadImage(contactId: String, imageFile: File): String? |
| EmailRepository.kt | `archiveOriginal` | suspend fun archiveOriginal(inReplyToMessageId: String): Result<Unit> |
| EmailRepository.kt | `backfillEstimate` | suspend fun backfillEstimate(): Result<EmailBackfillEstimateResponse> |
| EmailRepository.kt | `cancelSchedule` | suspend fun cancelSchedule(chitId: String): Result<Unit> |
| EmailRepository.kt | `downloadRawEml` | suspend fun downloadRawEml(chitId: String): Result<ByteArray> |
| EmailRepository.kt | `getPrivatePgpKey` | suspend fun getPrivatePgpKey(password: String): Result<String> |
| EmailRepository.kt | `markRead` | suspend fun markRead(chitId: String, read: Boolean): Result<Unit> |
| EmailRepository.kt | `scheduleEmail` | suspend fun scheduleEmail(chitId: String, sendAt: String): Result<Unit> |
| EmailRepository.kt | `sendEmail` | suspend fun sendEmail(chitId: String): Result<EmailSendResponse> |
| EmailRepository.kt | `syncEmail` | suspend fun syncEmail(backfill: Boolean = false): Result<EmailSyncResponse> |
| EmailRepository.kt | `testConnection` | suspend fun testConnection(config: Map<String, Any?>): Result<EmailTestConnectionResponse> |
| SettingsRepository.kt | `clearDirty` | suspend fun clearDirty() |
| SettingsRepository.kt | `get` | suspend fun get(): SettingsEntity? |
| SettingsRepository.kt | `replaceWithServerVersion` | suspend fun replaceWithServerVersion(settings: SettingsEntity) |
| SettingsRepository.kt | `update` | suspend fun update(settings: SettingsEntity) |
| StandaloneAlertRepository.kt | `StandaloneAlertDto` | private fun StandaloneAlertDto.toEntity(): StandaloneAlertEntity |
| StandaloneAlertRepository.kt | `create` | suspend fun create(type: String, name: String?, data: Map<String, Any?>): Result<StandaloneAlertDto> |
| StandaloneAlertRepository.kt | `delete` | suspend fun delete(id: String): Result<Unit> |
| StandaloneAlertRepository.kt | `fetchAndCache` | suspend fun fetchAndCache() |
| StandaloneAlertRepository.kt | `getAll` | fun getAll(): Flow<List<StandaloneAlertEntity>> = standaloneAlertDao.getAll() |
| StandaloneAlertRepository.kt | `getByType` | fun getByType(type: String): Flow<List<StandaloneAlertEntity>> = standaloneAlertDao.getByType(type) |
| StandaloneAlertRepository.kt | `update` | suspend fun update(id: String, body: Map<String, Any?>): Result<Unit> |
| SyncRepository.kt | `getHighWaterMark` | suspend fun getHighWaterMark(): Int |
| SyncRepository.kt | `getSyncMetadata` | suspend fun getSyncMetadata(): SyncMetadataEntity? |
| SyncRepository.kt | `performIncrementalSync` | suspend fun performIncrementalSync(): SyncResult |
| SyncRepository.kt | `performInitialSync` | suspend fun performInitialSync(): SyncResult |

## data/sync/

| File | Function | Signature |
|------|----------|----------|
| ConnectivityMonitor.kt | `checkCurrentConnectivity` | private fun checkCurrentConnectivity(): Boolean |
| ConnectivityMonitor.kt | `hasActiveNetwork` | private fun hasActiveNetwork(): Boolean |
| ConnectivityMonitor.kt | `onAvailable` | override fun onAvailable(network: Network) |
| ConnectivityMonitor.kt | `onCapabilitiesChanged` | override fun onCapabilitiesChanged( |
| ConnectivityMonitor.kt | `onLost` | override fun onLost(network: Network) |
| DirtyTracker.kt | `clearContactDirty` | suspend fun clearContactDirty(contactId: String) |
| DirtyTracker.kt | `clearDirty` | suspend fun clearDirty(chitId: String) |
| DirtyTracker.kt | `clearDirtyWithMerge` | suspend fun clearDirtyWithMerge(chitId: String, mergedEntity: ChitEntity) |
| DirtyTracker.kt | `clearSettingsDirty` | suspend fun clearSettingsDirty() |
| DirtyTracker.kt | `markContactDirty` | suspend fun markContactDirty(contactId: String, changedFields: Set<String>) |
| DirtyTracker.kt | `markDirty` | suspend fun markDirty(chitId: String, changedFields: Set<String>) |
| DirtyTracker.kt | `markSettingsDirty` | suspend fun markSettingsDirty() |
| DirtyTracker.kt | `parseDirtyFields` | private fun parseDirtyFields(json: String?): Set<String> |
| DirtyTracker.kt | `serializeDirtyFields` | private fun serializeDirtyFields(fields: Set<String>): String |
| DtoMappers.kt | `Any` | private fun Any?.toJsonString(gson: Gson): String? |
| DtoMappers.kt | `ChitDto` | fun ChitDto.toEntity(syncedAt: String, gson: Gson): ChitEntity |
| DtoMappers.kt | `ContactDto` | fun ContactDto.toEntity(syncedAt: String, gson: Gson): ContactEntity |
| DtoMappers.kt | `SettingsDto` | fun SettingsDto.toEntity(syncedAt: String, gson: Gson): SettingsEntity |
| EdgeCaseHandler.kt | `applyChecklistMerge` | suspend fun applyChecklistMerge(chitId: String, serverChecklist: String) |
| EdgeCaseHandler.kt | `applyTagRename` | suspend fun applyTagRename(oldTag: String, newTag: String) |
| EdgeCaseHandler.kt | `handleServerDeletion` | suspend fun handleServerDeletion(chitId: String) |
| EdgeCaseHandler.kt | `parseDirtyFields` | private fun parseDirtyFields(json: String?): List<String> |
| LostEditLogger.kt | `clear` | fun clear() |
| LostEditLogger.kt | `getEntries` | fun getEntries(): List<LostEditEntry> |
| LostEditLogger.kt | `logLostEdit` | fun logLostEdit(chitId: String, title: String?, dirtyFields: List<String>) |
| PushSyncWorker.kt | `cancel` | fun cancel(context: Context) |
| PushSyncWorker.kt | `enqueueOnce` | fun enqueueOnce(context: Context) |
| SyncEngine.kt | `buildApiService` | private fun buildApiService(): CwocApiService? |
| SyncEngine.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| SyncEngine.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| SyncEngine.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf() |
| SyncEngine.kt | `performSync` | suspend fun performSync(since: Int = 0): SyncResult |
| SyncEngine.kt | `reportLog` | suspend fun reportLog(message: String, level: String = "info") |
| SyncOrchestrator.kt | `handleOffline` | private fun handleOffline() |
| SyncOrchestrator.kt | `handleOnline` | private fun handleOnline() |
| SyncOrchestrator.kt | `start` | fun start() |
| SyncPushEngine.kt | `pushAll` | suspend fun pushAll(): PushResult |
| SyncPushEngine.kt | `pushSingle` | suspend fun pushSingle(chitId: String): PushResult |
| SyncStateManager.kt | `deriveState` | private fun deriveState(isOnline: Boolean, isSyncing: Boolean): SyncState |
| SyncStateManager.kt | `setIdle` | fun setIdle() |
| SyncStateManager.kt | `setSyncing` | fun setSyncing() |
| SyncWorker.kt | `cancel` | fun cancel(context: Context) |
| SyncWorker.kt | `enqueue` | fun enqueue(context: Context) |
| WebSocketClient.kt | `buildWebSocketUrl` | private fun buildWebSocketUrl(): String? |
| WebSocketClient.kt | `connect` | fun connect() |
| WebSocketClient.kt | `disconnect` | fun disconnect() |
| WebSocketClient.kt | `establishConnection` | private fun establishConnection() |
| WebSocketClient.kt | `onClosed` | override fun onClosed(webSocket: WebSocket, code: Int, reason: String) |
| WebSocketClient.kt | `onClosing` | override fun onClosing(webSocket: WebSocket, code: Int, reason: String) |
| WebSocketClient.kt | `onFailure` | override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) |
| WebSocketClient.kt | `onMessage` | override fun onMessage(webSocket: WebSocket, text: String) |
| WebSocketClient.kt | `onOpen` | override fun onOpen(webSocket: WebSocket, response: Response) |
| WebSocketClient.kt | `parseMessage` | private fun parseMessage(text: String): WebSocketMessage? |
| WebSocketClient.kt | `scheduleReconnect` | private fun scheduleReconnect() |

## di/

| File | Function | Signature |
|------|----------|----------|
| AppModule.kt | `provideAttachmentMetadataDao` | fun provideAttachmentMetadataDao(db: CwocDatabase): AttachmentMetadataDao = db.attachmentMetadataDao() |
| AppModule.kt | `provideChitDao` | fun provideChitDao(db: CwocDatabase): ChitDao = db.chitDao() |
| AppModule.kt | `provideContactDao` | fun provideContactDao(db: CwocDatabase): ContactDao = db.contactDao() |
| AppModule.kt | `provideCwocDatabase` | fun provideCwocDatabase( |
| AppModule.kt | `provideEncryptedSharedPreferences` | fun provideEncryptedSharedPreferences( |
| AppModule.kt | `provideNotificationDao` | fun provideNotificationDao(db: CwocDatabase): NotificationDao = db.notificationDao() |
| AppModule.kt | `provideSettingsDao` | fun provideSettingsDao(db: CwocDatabase): SettingsDao = db.settingsDao() |
| AppModule.kt | `provideStandaloneAlertDao` | fun provideStandaloneAlertDao(db: CwocDatabase): StandaloneAlertDao = db.standaloneAlertDao() |
| AppModule.kt | `provideSyncMetadataDao` | fun provideSyncMetadataDao(db: CwocDatabase): SyncMetadataDao = db.syncMetadataDao() |
| NetworkModule.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| NetworkModule.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) |
| NetworkModule.kt | `emitTokenRevokedSync` | override fun emitTokenRevokedSync() |
| NetworkModule.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf() |
| NetworkModule.kt | `provideAuthEventEmitter` | fun provideAuthEventEmitter(authRepository: dagger.Lazy<AuthRepository>): AuthEventEmitter |
| NetworkModule.kt | `provideAuthInterceptor` | fun provideAuthInterceptor(prefs: SharedPreferences): AuthInterceptor |
| NetworkModule.kt | `provideCwocApiService` | fun provideCwocApiService(retrofit: Retrofit): CwocApiService |
| NetworkModule.kt | `provideGson` | fun provideGson(): Gson |
| NetworkModule.kt | `provideLoggingInterceptor` | fun provideLoggingInterceptor(): HttpLoggingInterceptor |
| NetworkModule.kt | `provideOkHttpClient` | fun provideOkHttpClient( |
| NetworkModule.kt | `provideRetrofit` | fun provideRetrofit( |
| NetworkModule.kt | `provideTokenAuthenticator` | fun provideTokenAuthenticator( |
| SyncModule.kt | `bindAttachmentCache` | abstract fun bindAttachmentCache( |
| SyncModule.kt | `bindAttachmentManager` | abstract fun bindAttachmentManager( |
| SyncModule.kt | `bindBundleRepository` | abstract fun bindBundleRepository( |
| SyncModule.kt | `bindConnectivityMonitor` | abstract fun bindConnectivityMonitor( |
| SyncModule.kt | `bindContactRepository` | abstract fun bindContactRepository( |
| SyncModule.kt | `bindDirtyTracker` | abstract fun bindDirtyTracker( |
| SyncModule.kt | `bindEdgeCaseHandler` | abstract fun bindEdgeCaseHandler( |
| SyncModule.kt | `bindEmailRepository` | abstract fun bindEmailRepository( |
| SyncModule.kt | `bindNotificationScheduler` | abstract fun bindNotificationScheduler( |
| SyncModule.kt | `bindSettingsRepository` | abstract fun bindSettingsRepository( |
| SyncModule.kt | `bindSyncPushEngine` | abstract fun bindSyncPushEngine( |
| SyncModule.kt | `bindSyncStateManager` | abstract fun bindSyncStateManager( |
| SyncModule.kt | `bindWebSocketClient` | abstract fun bindWebSocketClient( |

## domain/alerts/

| File | Function | Signature |
|------|----------|----------|
| AlertClassifier.kt | `classifyAlerts` | fun classifyAlerts( |
| AlertClassifier.kt | `parseAlertTime` | private fun parseAlertTime(datetime: String?): LocalDateTime? |
| AlertClassifier.kt | `parseAlerts` | fun parseAlerts(json: String?): List<RawAlert> |
| StopwatchRuntime.kt | `emitState` | private fun emitState() |
| StopwatchRuntime.kt | `formatElapsed` | fun formatElapsed(ms: Long): String |
| StopwatchRuntime.kt | `lap` | fun lap() |
| StopwatchRuntime.kt | `pause` | fun pause() |
| StopwatchRuntime.kt | `reset` | fun reset() |
| StopwatchRuntime.kt | `start` | fun start() |
| TimerRuntime.kt | `emitState` | private fun emitState() |
| TimerRuntime.kt | `pause` | fun pause() |
| TimerRuntime.kt | `reset` | fun reset() |
| TimerRuntime.kt | `setDuration` | fun setDuration(hours: Int, minutes: Int, seconds: Int) |
| TimerRuntime.kt | `start` | fun start() |
| TimerRuntime.kt | `startTicking` | private fun startTicking() |

## domain/chart/

| File | Function | Signature |
|------|----------|----------|
| ChartDataTransformer.kt | `filterByRange` | fun filterByRange( |
| ChartDataTransformer.kt | `groupByType` | fun groupByType(points: List<ChartDataPoint>): Map<String, List<ChartDataPoint>> |
| ChartDataTransformer.kt | `hitTest` | fun hitTest( |
| ChartDataTransformer.kt | `mapToPixels` | fun mapToPixels( |
| ChartDataTransformer.kt | `parseHealthData` | fun parseHealthData(json: String?): List<ChartDataPoint> |

## domain/checklist/

| File | Function | Signature |
|------|----------|----------|
| ChecklistOperations.kt | `indentationDp` | fun indentationDp(indent: Int): Int |
| ChecklistOperations.kt | `parseChecklist` | fun parseChecklist(json: String?): List<ChecklistItem> |
| ChecklistOperations.kt | `reorderChecklistItem` | fun reorderChecklistItem( |
| ChecklistOperations.kt | `serializeChecklist` | fun serializeChecklist(items: List<ChecklistItem>): String |
| ChecklistOperations.kt | `toggleChecklistItem` | fun toggleChecklistItem(items: List<ChecklistItem>, index: Int): List<ChecklistItem> |
| ChecklistOperationsV2.kt | `addItem` | fun addItem( |
| ChecklistOperationsV2.kt | `deleteWithSubtree` | fun deleteWithSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `findParentForLevel` | private fun findParentForLevel(items: List<ChecklistItemV2>, idx: Int, targetLevel: Int): String? |
| ChecklistOperationsV2.kt | `generateId` | fun generateId(): String = UUID.randomUUID().toString() |
| ChecklistOperationsV2.kt | `getChildren` | fun getChildren(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `getGhostParents` | fun getGhostParents(items: List<ChecklistItemV2>): Set<String> |
| ChecklistOperationsV2.kt | `getParent` | fun getParent(items: List<ChecklistItemV2>, item: ChecklistItemV2): ChecklistItemV2? |
| ChecklistOperationsV2.kt | `getSubtree` | fun getSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `indent` | fun indent(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `indentSubtree` | fun indentSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `isDescendant` | private fun isDescendant( |
| ChecklistOperationsV2.kt | `itemsToMarkdown` | fun itemsToMarkdown(items: List<ChecklistItemV2>): String |
| ChecklistOperationsV2.kt | `moveAbove` | fun moveAbove( |
| ChecklistOperationsV2.kt | `moveBelow` | fun moveBelow( |
| ChecklistOperationsV2.kt | `moveOnto` | fun moveOnto( |
| ChecklistOperationsV2.kt | `outdent` | fun outdent(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `outdentSubtree` | fun outdentSubtree(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `parse` | fun parse(json: String?): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `parseClipboardText` | fun parseClipboardText(text: String): List<ChecklistItemV2> |
| ChecklistOperationsV2.kt | `serialize` | fun serialize(items: List<ChecklistItemV2>): String |
| ChecklistOperationsV2.kt | `splitItem` | fun splitItem( |
| ChecklistOperationsV2.kt | `toggleCheck` | fun toggleCheck(items: List<ChecklistItemV2>, itemId: String): List<ChecklistItemV2> |

## domain/email/

| File | Function | Signature |
|------|----------|----------|
| AutocompleteSearch.kt | `extractEmails` | private fun extractEmails(emailsJson: String?): List<String> |
| AutocompleteSearch.kt | `isAlreadyChipped` | private fun isAlreadyChipped(contact: ContactEntity, chipsLower: Set<String>): Boolean |
| AutocompleteSearch.kt | `matchesQuery` | private fun matchesQuery(contact: ContactEntity, lowerQuery: String): Boolean |
| AutocompleteSearch.kt | `search` | fun search( |
| BodyPreviewStripper.kt | `decodeHtmlEntities` | private fun decodeHtmlEntities(text: String): String |
| BodyPreviewStripper.kt | `strip` | fun strip(body: String?): String |
| ContrastColor.kt | `contrastRatio` | fun contrastRatio(fg: Color, bg: Color): Double |
| ContrastColor.kt | `forBackground` | fun forBackground(backgroundColor: Color): Color |
| ContrastColor.kt | `linearize` | private fun linearize(srgb: Double): Double |
| ContrastColor.kt | `relativeLuminance` | private fun relativeLuminance(color: Color): Double |
| DateGrouper.kt | `assign` | fun assign(dateStr: String?): DateGroup |
| DateGrouper.kt | `parseToLocalDate` | private fun parseToLocalDate(dateStr: String): LocalDate? |
| DraftDetector.kt | `findExistingForward` | fun findExistingForward(drafts: List<ChitEntity>, originalSubject: String?): ChitEntity? |
| DraftDetector.kt | `findExistingReply` | fun findExistingReply(drafts: List<ChitEntity>, originalMessageId: String?): ChitEntity? |
| DraftDetector.kt | `normalizeSubject` | private fun normalizeSubject(subject: String): String |
| EmailDateFormatter.kt | `format` | fun format(dateStr: String?, use24Hour: Boolean = false): String |
| EmailDateFormatter.kt | `parseDateTime` | private fun parseDateTime(dateStr: String): LocalDateTime? |
| MarkdownFormatter.kt | `applyBlockquote` | fun applyBlockquote(text: String, selection: TextSelection): String |
| MarkdownFormatter.kt | `applyBold` | fun applyBold(text: String, selection: TextSelection): String |
| MarkdownFormatter.kt | `applyBulletList` | fun applyBulletList(text: String, lineStart: Int): String |
| MarkdownFormatter.kt | `applyHeading` | fun applyHeading(text: String, lineStart: Int, level: Int): String |
| MarkdownFormatter.kt | `applyHorizontalRule` | fun applyHorizontalRule(text: String, cursorPos: Int): String |
| MarkdownFormatter.kt | `applyInlineCode` | fun applyInlineCode(text: String, selection: TextSelection): String |
| MarkdownFormatter.kt | `applyItalic` | fun applyItalic(text: String, selection: TextSelection): String |
| MarkdownFormatter.kt | `applyLink` | fun applyLink(text: String, selection: TextSelection, url: String): String |
| MarkdownFormatter.kt | `applyNumberedList` | fun applyNumberedList(text: String, lineStart: Int): String |
| MarkdownFormatter.kt | `applyStrikethrough` | fun applyStrikethrough(text: String, selection: TextSelection): String |
| MarkdownFormatter.kt | `wrapSelection` | private fun wrapSelection( |
| PgpManager.kt | `compressData` | private fun compressData(data: ByteArray): ByteArray |
| PgpManager.kt | `decrypt` | fun decrypt(ciphertext: String, privateKey: String, passphrase: String = ""): String |
| PgpManager.kt | `encrypt` | fun encrypt(plaintext: String, recipientPublicKeys: List<String>): String |
| PgpManager.kt | `extractEncryptionKey` | private fun extractEncryptionKey(armoredPublicKey: String): PGPPublicKey? |
| PgpManager.kt | `extractLiteralData` | private fun extractLiteralData(factory: PGPObjectFactory): ByteArray |
| PgpManager.kt | `parseEncryptedDataList` | private fun parseEncryptedDataList(armoredCiphertext: String): PGPEncryptedDataList |
| PgpManager.kt | `parseSecretKeyRingCollection` | private fun parseSecretKeyRingCollection(armoredPrivateKey: String): PGPSecretKeyRingCollection |
| SmartLinkDetector.kt | `detect` | fun detect(bodyText: String, maxBadges: Int = 3): List<SmartLink> |

## domain/filter/

| File | Function | Signature |
|------|----------|----------|
| FilterEngine.kt | `applyFilters` | fun applyFilters( |
| FilterEngine.kt | `isPastDue` | private fun isPastDue(chit: ChitEntity, now: Instant): Boolean |
| FilterEngine.kt | `isSnoozed` | private fun isSnoozed(chit: ChitEntity, now: Instant): Boolean |
| FilterEngine.kt | `passesAllFilters` | private fun passesAllFilters( |
| FilterEngine.kt | `passesProjectFilter` | private fun passesProjectFilter( |

## domain/recurrence/

| File | Function | Signature |
|------|----------|----------|
| RecurrenceEngine.kt | `advanceDate` | private fun advanceDate( |
| RecurrenceEngine.kt | `expand` | fun expand( |
| RecurrenceEngine.kt | `formatRule` | fun formatRule(rule: RecurrenceRule, isHabit: Boolean = false): String |
| RecurrenceEngine.kt | `parseDate` | private fun parseDate(dateStr: String): LocalDate? |

## domain/search/

| File | Function | Signature |
|------|----------|----------|
| BooleanSearchEvaluator.kt | `evaluate` | private fun evaluate(node: SearchNode, text: String): Boolean |
| BooleanSearchEvaluator.kt | `extractSearchableText` | fun extractSearchableText(chit: ChitEntity): String |
| BooleanSearchEvaluator.kt | `matches` | fun matches(chit: ChitEntity, node: SearchNode): Boolean |
| BooleanSearchParser.kt | `parse` | fun parse(query: String): SearchNode? |
| BooleanSearchParser.kt | `parseAnd` | private fun parseAnd(): SearchNode |
| BooleanSearchParser.kt | `parseAtom` | private fun parseAtom(): SearchNode |
| BooleanSearchParser.kt | `parseNot` | private fun parseNot(): SearchNode |
| BooleanSearchParser.kt | `parseOr` | private fun parseOr(): SearchNode |
| BooleanSearchParser.kt | `tokenize` | private fun tokenize(input: String): List<String> |

## domain/sort/

| File | Function | Signature |
|------|----------|----------|
| SortEngine.kt | `buildComparator` | private fun buildComparator( |
| SortEngine.kt | `compareByField` | private fun compareByField(a: ChitEntity, b: ChitEntity, field: SortField): Int |
| SortEngine.kt | `compareByOrdinal` | private fun compareByOrdinal( |
| SortEngine.kt | `compareNullableStrings` | private fun compareNullableStrings(a: String?, b: String?): Int |
| SortEngine.kt | `sort` | fun sort( |

## domain/tags/

| File | Function | Signature |
|------|----------|----------|
| TagTreeParser.kt | `flattenTree` | fun flattenTree(tree: List<TagNode>): List<TagNode> |
| TagTreeParser.kt | `getLeafTags` | fun getLeafTags(tree: List<TagNode>): List<TagNode> |
| TagTreeParser.kt | `inheritColors` | private fun inheritColors(nodes: List<TagNode>, parentColor: String?) |
| TagTreeParser.kt | `parseRawTags` | private fun parseRawTags(json: String): List<RawTag> |
| TagTreeParser.kt | `parseTagTree` | fun parseTagTree(tagsJson: String?): List<TagNode> |
| TagTreeParser.kt | `sortTree` | private fun sortTree(nodes: MutableList<TagNode>) |
| TagTreeParser.kt | `walk` | fun walk(nodes: List<TagNode>) |

## notification/

| File | Function | Signature |
|------|----------|----------|
| AlarmReceiver.kt | `getRequestCode` | private fun getRequestCode(chitId: String, alertIndex: Int): Int |
| AlarmReceiver.kt | `onReceive` | override fun onReceive(context: Context, intent: Intent) |
| AlarmSoundPlayer.kt | `isPlaying` | fun isPlaying(): Boolean |
| AlarmSoundPlayer.kt | `play` | fun play(context: Context) |
| AlarmSoundPlayer.kt | `playLooping` | fun playLooping(context: Context) |
| AlarmSoundPlayer.kt | `stop` | fun stop() |
| BootReceiver.kt | `notificationScheduler` | fun notificationScheduler(): NotificationScheduler |
| BootReceiver.kt | `onReceive` | override fun onReceive(context: Context, intent: Intent) |
| ExactAlarmPermissionHelper.kt | `createPermissionRequestIntent` | fun createPermissionRequestIntent(): Intent? |
| ExactAlarmPermissionHelper.kt | `hasPermission` | fun hasPermission(): Boolean |
| ExactAlarmPermissionHelper.kt | `logPermissionState` | fun logPermissionState() |
| NotificationChannelManager.kt | `createChannels` | fun createChannels() |
| NotificationScheduler.kt | `cancelAlarms` | suspend fun cancelAlarms(chitId: String) |
| NotificationScheduler.kt | `createAlarmIntent` | private fun createAlarmIntent( |
| NotificationScheduler.kt | `getRequestCode` | private fun getRequestCode(chitId: String, alertIndex: Int): Int |
| NotificationScheduler.kt | `hasExactAlarmPermission` | fun hasExactAlarmPermission(): Boolean |
| NotificationScheduler.kt | `parseAlerts` | private fun parseAlerts(chit: ChitEntity): List<ChitAlert> |
| NotificationScheduler.kt | `rescheduleAll` | suspend fun rescheduleAll() |
| NotificationScheduler.kt | `scheduleAlarms` | suspend fun scheduleAlarms(chit: ChitEntity) |
| NotificationScheduler.kt | `scheduleExactAlarm` | private fun scheduleExactAlarm(alert: ChitAlert) |
| TimerNotificationHelper.kt | `fireTimerCompleteNotification` | fun fireTimerCompleteNotification(alertId: String, timerName: String?) |

## ui/components/

| File | Function | Signature |
|------|----------|----------|
| ArrangeViewsDialog.kt | `ArrangeViewRow` | private fun ArrangeViewRow( |
| ArrangeViewsDialog.kt | `ArrangeViewsDialog` | fun ArrangeViewsDialog( |
| ArrangeViewsDialog.kt | `HiddenViewRow` | private fun HiddenViewRow( |
| ArrangeViewsDialog.kt | `OmniFixedRow` | private fun OmniFixedRow() |
| ArrangeViewsDialog.kt | `parseHiddenEntries` | internal fun parseHiddenEntries(viewOrder: String): List<ViewTabEntry> |
| ArrangeViewsDialog.kt | `parseViewOrder` | internal fun parseViewOrder(viewOrder: String): List<ViewTabEntry> |
| ArrangeViewsDialog.kt | `parseVisibleEntries` | internal fun parseVisibleEntries(viewOrder: String): List<ViewTabEntry> |
| ArrangeViewsDialog.kt | `serializeViewOrder` | internal fun serializeViewOrder(entries: List<ViewTabEntry>): String |
| CalculatorSheet.kt | `CalcDigitButton` | private fun CalcDigitButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) |
| CalculatorSheet.kt | `CalcOperatorButton` | private fun CalcOperatorButton( |
| CalculatorSheet.kt | `CalculatorDisplay` | private fun CalculatorDisplay(expression: String, result: String) |
| CalculatorSheet.kt | `CalculatorKeypad` | private fun CalculatorKeypad( |
| CalculatorSheet.kt | `CalculatorSheet` | fun CalculatorSheet( |
| CalculatorSheet.kt | `evaluateExpression` | internal fun evaluateExpression(expr: String): String |
| CalculatorSheet.kt | `parseExpression` | private fun parseExpression(tokens: List<String>): Double |
| CalculatorSheet.kt | `tokenize` | private fun tokenize(expr: String): List<String> |
| ChitActionMenu.kt | `ChitActionMenu` | fun ChitActionMenu( |
| ChitCardEnhancements.kt | `ArchiveSnoozeIndicators` | fun ArchiveSnoozeIndicators( |
| ChitCardEnhancements.kt | `ChecklistProgressBadge` | fun ChecklistProgressBadge( |
| ChitCardEnhancements.kt | `HealthIndicatorBadges` | fun HealthIndicatorBadges( |
| ChitCardEnhancements.kt | `LocationIndicator` | fun LocationIndicator( |
| ChitCardEnhancements.kt | `Modifier` | fun Modifier.chitColorBorder(color: String?): Modifier |
| ChitCardEnhancements.kt | `PeopleChipsRow` | fun PeopleChipsRow( |
| ChitCardEnhancements.kt | `PersonChip` | private fun PersonChip(name: String) |
| ChitCardEnhancements.kt | `RsvpIndicators` | fun RsvpIndicators( |
| ChitCardEnhancements.kt | `SharingIndicators` | fun SharingIndicators( |
| ChitCardEnhancements.kt | `TagChip` | private fun TagChip(tagName: String, configuredColor: String? = null) |
| ChitCardEnhancements.kt | `TagChipsRow` | fun TagChipsRow( |
| ChitCardEnhancements.kt | `WeatherIndicator` | fun WeatherIndicator( |
| ChitCardEnhancements.kt | `countChecklistItems` | private fun countChecklistItems(items: List<Map<String, Any>>): Pair<Int, Int> |
| ChitCardEnhancements.kt | `filterSnoozedItems` | fun filterSnoozedItems(items: List<ChitEntity>, hideSnoozed: Boolean = true): List<ChitEntity> |
| ChitCardEnhancements.kt | `isOverdue` | fun isOverdue(chit: ChitEntity): Boolean |
| ChitCardEnhancements.kt | `isPastEvent` | fun isPastEvent(chit: ChitEntity): Boolean |
| ChitCardEnhancements.kt | `parseChecklistProgress` | private fun parseChecklistProgress(json: String): Pair<Int, Int> |
| ChitCardEnhancements.kt | `parseHealthIndicators` | private fun parseHealthIndicators(json: String): List<Pair<String, String>> |
| ChitCardEnhancements.kt | `parseHexColor` | fun parseHexColor(hex: String?): Color? |
| ChitCardEnhancements.kt | `parseWeatherData` | private fun parseWeatherData(json: String): WeatherInfo? |
| ChitCardEnhancements.kt | `tagColor` | private fun tagColor(tagName: String): Color |
| ChitCardEnhancements.kt | `weatherCodeToEmoji` | private fun weatherCodeToEmoji(code: Int): String |
| ChitListScaffold.kt | `ChitListScaffold` | fun ChitListScaffold( |
| ChitPickerSheet.kt | `ChitPickerSheet` | fun ChitPickerSheet( |
| ClockModal.kt | `ClockModal` | fun ClockModal( |
| CollapsibleSection.kt | `CollapsibleSection` | fun CollapsibleSection( |
| CollapsibleZone.kt | `CollapsibleZone` | fun CollapsibleZone( |
| CollapsibleZone.kt | `PeopleSectionHeader` | fun PeopleSectionHeader( |
| ConflictBanner.kt | `ConflictBanner` | fun ConflictBanner( |
| CwocButton.kt | `CwocPrimaryButton` | fun CwocPrimaryButton( |
| CwocButton.kt | `CwocZoneButton` | fun CwocZoneButton( |
| CwocChitCardStyle.kt | `cardColors` | fun cardColors(): CardColors = CardDefaults.cardColors( |
| CwocChitCardStyle.kt | `cardColorsForChit` | fun cardColorsForChit(colorHex: String?): CardColors |
| CwocChitCardStyle.kt | `cardElevation` | fun cardElevation(): CardElevation = CardDefaults.cardElevation( |
| CwocChitCardStyle.kt | `contrastTextColor` | fun contrastTextColor(bgColor: Color): Color |
| CwocChitCardStyle.kt | `resolveChitBgColor` | fun resolveChitBgColor(colorHex: String?): Color |
| CwocPromptDialog.kt | `CwocPromptDialog` | fun CwocPromptDialog( |
| CwocTextField.kt | `cwocTextFieldColors` | fun cwocTextFieldColors(): TextFieldColors |
| DropdownWithCustom.kt | `DropdownWithCustom` | fun DropdownWithCustom( |
| DrumRollerTimePicker.kt | `AmPmInput` | private fun AmPmInput( |
| DrumRollerTimePicker.kt | `DrumColumn` | private fun DrumColumn( |
| DrumRollerTimePicker.kt | `DrumRollerButton` | private fun DrumRollerButton( |
| DrumRollerTimePicker.kt | `DrumRollerTimePicker` | fun DrumRollerTimePicker( |
| DrumRollerTimePicker.kt | `OverwriteInput` | private fun OverwriteInput( |
| DrumRollerTimePicker.kt | `confirmAndClose` | fun confirmAndClose() |
| DrumRollerTimePicker.kt | `rememberSnapFlingBehavior` | private fun rememberSnapFlingBehavior( |
| DrumRollerTimePicker.kt | `syncInputsFromDrums` | fun syncInputsFromDrums() |
| DrumRollerTimePicker.kt | `validateHourInput` | private fun validateHourInput(text: String, is24Hour: Boolean): InputValidationResult? |
| DrumRollerTimePicker.kt | `validateMinuteInput` | private fun validateMinuteInput(text: String): InputValidationResult? |
| FlatpickrCalendarPicker.kt | `CalendarHeader` | private fun CalendarHeader( |
| FlatpickrCalendarPicker.kt | `DayCell` | private fun DayCell( |
| FlatpickrCalendarPicker.kt | `DayGrid` | private fun DayGrid( |
| FlatpickrCalendarPicker.kt | `DayOfWeekHeader` | private fun DayOfWeekHeader() |
| FlatpickrCalendarPicker.kt | `FlatpickrCalendarPicker` | fun FlatpickrCalendarPicker( |
| FlatpickrCalendarPicker.kt | `buildDayGrid` | private fun buildDayGrid(yearMonth: YearMonth): List<LocalDate> |
| FlatpickrCalendarPicker.kt | `formatYMDDate` | fun formatYMDDate(date: LocalDate): String |
| FlatpickrCalendarPicker.kt | `parseYMDDate` | fun parseYMDDate(dateStr: String?): LocalDate? |
| ImageViewDialog.kt | `ImageViewDialog` | fun ImageViewDialog( |
| MarkdownRenderer.kt | `MarkdownRenderer` | fun MarkdownRenderer( |
| MarkdownRenderer.kt | `handleLinkClick` | private fun handleLinkClick( |
| MarkdownRenderer.kt | `headingStyle` | private fun headingStyle(level: Int): TextStyle |
| MarkdownRenderer.kt | `parseInlineFormatting` | private fun parseInlineFormatting(text: String): AnnotatedString |
| MarkdownRenderer.kt | `parseMarkdownBlocks` | private fun parseMarkdownBlocks(markdown: String): List<MarkdownBlock> |
| MiniChart.kt | `MiniBarChart` | fun MiniBarChart( |
| MiniChart.kt | `MiniLineChart` | fun MiniLineChart( |
| MultiValueSection.kt | `MultiValueSection` | fun MultiValueSection( |
| MultiValueSection.kt | `firstMultiValue` | fun firstMultiValue(json: String?): String? |
| MultiValueSection.kt | `parseMultiValueJson` | fun parseMultiValueJson(json: String?): List<MultiValueEntry> |
| MultiValueSection.kt | `serializeMultiValue` | fun serializeMultiValue(entries: List<MultiValueEntry>): String? |
| ProfileMenu.kt | `NotificationCard` | private fun NotificationCard( |
| ProfileMenu.kt | `ProfileMenu` | fun ProfileMenu( |
| PullToRefreshWrapper.kt | `PullToRefreshListScreen` | fun PullToRefreshListScreen( |
| QrCodeDialog.kt | `ChitQrCodeDialog` | fun ChitQrCodeDialog( |
| QrCodeDialog.kt | `ContactFormQrCodeDialog` | fun ContactFormQrCodeDialog( |
| QrCodeDialog.kt | `ContactQrCodeDialog` | fun ContactQrCodeDialog( |
| QrCodeDialog.kt | `addMulti` | fun addMulti(prop: String, json: String) |
| QrCodeDialog.kt | `buildVCardFromForm` | private fun buildVCardFromForm( |
| QrCodeDialog.kt | `generateQrBitmap` | internal fun generateQrBitmap(data: String, size: Int): Bitmap? |
| QuickEditSheet.kt | `QuickEditSheet` | fun QuickEditSheet( |
| RecurringEditDialog.kt | `RecurringEditDialog` | fun RecurringEditDialog( |
| ReferenceDialog.kt | `ReferenceDialog` | fun ReferenceDialog( |
| ReferenceDialog.kt | `ReferenceItem` | private fun ReferenceItem(gesture: String, action: String) |
| ReferenceDialog.kt | `ReferenceSection` | private fun ReferenceSection(title: String, content: @Composable () -> Unit) |
| ReleaseNotesDialog.kt | `ReleaseNotesDialog` | fun ReleaseNotesDialog( |
| ReleaseNotesDialog.kt | `formatReleaseNoteDate` | private fun formatReleaseNoteDate(dateStr: String): String |
| SidebarCompactButton.kt | `SidebarCompactButton` | fun SidebarCompactButton( |
| SnoozePickerDialog.kt | `SnoozePickerDialog` | fun SnoozePickerDialog( |
| SnoozePickerDialog.kt | `buildCustomSnoozeTime` | private fun buildCustomSnoozeTime( |
| SnoozePickerDialog.kt | `calculateNextMonday9am` | private fun calculateNextMonday9am(): Instant |
| SnoozePickerDialog.kt | `calculateTomorrow9am` | private fun calculateTomorrow9am(): Instant |
| SnoozePickerDialog.kt | `formatInstantToIso` | private fun formatInstantToIso(instant: Instant): String |
| SwipeableChitCard.kt | `SwipeableChitCard` | fun SwipeableChitCard( |
| SyncStateIndicator.kt | `SyncStateIndicator` | fun SyncStateIndicator( |
| TagCreateDialog.kt | `TagCreateDialog` | fun TagCreateDialog( |
| TagCreateDialog.kt | `parseTagColorHex` | private fun parseTagColorHex(hex: String): Color |
| TagCreateDialog.kt | `walk` | fun walk(nodes: List<TagNode>, depth: Int) |
| TimezonePickerModal.kt | `TimezonePickerModal` | fun TimezonePickerModal( |
| TimezonePickerModal.kt | `ZoneButton` | fun ZoneButton( |
| TimezonePickerModal.kt | `detectTimezoneFromCoords` | internal fun detectTimezoneFromCoords(lat: Double, lon: Double, countryCode: String?): String? |
| TimezonePickerModal.kt | `findExactTimezone` | private fun findExactTimezone(input: String): String? |
| TimezonePickerModal.kt | `formatCommonTzDisplay` | private fun formatCommonTzDisplay(entry: CommonTzEntry): String |
| TimezonePickerModal.kt | `getTimezoneAbbreviation` | private fun getTimezoneAbbreviation(tzId: String): String |
| TimezonePickerModal.kt | `isValidTimezone` | private fun isValidTimezone(tz: String): Boolean |
| TimezoneSuggestionPrompt.kt | `TimezoneSuggestionPrompt` | fun TimezoneSuggestionPrompt( |
| UndoToast.kt | `UndoToast` | fun UndoToast( |
| WeatherModal.kt | `WeatherModal` | fun WeatherModal( |
| WeatherModal.kt | `fetchWeather` | fun fetchWeather(address: String) |
| WeatherModal.kt | `weatherCodeToDescription` | private fun weatherCodeToDescription(code: Int): String = when (code) |
| WeatherModal.kt | `weatherCodeToIcon` | private fun weatherCodeToIcon(code: Int): String = when (code) |

## ui/components/swipe/

| File | Function | Signature |
|------|----------|----------|
| SwipeActionState.kt | `applyArchive` | fun applyArchive(chit: ChitEntity): Pair<SwipeActionResult, ChitEntity> |
| SwipeActionState.kt | `applySnooze` | fun applySnooze(chit: ChitEntity, snoozeUntil: String): Pair<SwipeActionResult, ChitEntity> |
| SwipeActionState.kt | `undoSwipeAction` | fun undoSwipeAction(chit: ChitEntity, result: SwipeActionResult): ChitEntity |
| SwipeToAction.kt | `SwipeBackground` | private fun SwipeBackground(dismissState: SwipeToDismissBoxState) |
| SwipeToAction.kt | `SwipeToAction` | fun SwipeToAction( |

## ui/navigation/

| File | Function | Signature |
|------|----------|----------|
| CCaptnTabRow.kt | `CCaptnTabRow` | fun CCaptnTabRow( |
| CCaptnTabRow.kt | `getOrderedVisibleTabs` | fun getOrderedVisibleTabs(viewOrder: String?): List<CCaptnTab> |
| CwocNavGraph.kt | `CwocNavGraph` | fun CwocNavGraph( |
| FilterPanel.kt | `FilterPanel` | fun FilterPanel( |
| FilterPanel.kt | `FilterToggleRow` | private fun FilterToggleRow( |
| Screen.kt | `createProfileRoute` | fun createProfileRoute(userId: String) = "contact-editor/profile?userId=$userId" |
| Screen.kt | `createRoute` | fun createRoute(tab: String? = null, section: String? = null): String |
| Screen.kt | `createRouteWithPrefill` | fun createRouteWithPrefill(start: String, end: String) = "editor/new?start=$start&end=$end" |
| SidebarContent.kt | `EmailAccountPills` | private fun EmailAccountPills(accounts: List<String>, selectedAccounts: List<String>, onAccountToggle: (String) -> Unit) |
| SidebarContent.kt | `HabitsSuccessWindowDropdown` | private fun HabitsSuccessWindowDropdown(currentWindow: Int, onWindowChange: (Int) -> Unit) |
| SidebarContent.kt | `SidebarContent` | fun SidebarContent( |
| SidebarContent.kt | `TimePeriodDropdown` | private fun TimePeriodDropdown(currentPeriod: String, onPeriodChange: (String) -> Unit) |
| SidebarContent.kt | `ViewModeButton` | private fun ViewModeButton( |
| SortPanel.kt | `SortField` | private fun SortField.displayLabel(): String = when (this) |
| SortPanel.kt | `SortPanel` | fun SortPanel( |
| ViewsPanel.kt | `RightEdgeSwipeDetector` | fun RightEdgeSwipeDetector( |
| ViewsPanel.kt | `ViewsPanel` | fun ViewsPanel( |
| ViewsPanel.kt | `ViewsPanelItem` | private fun ViewsPanelItem( |

## ui/screens/adminchits/

| File | Function | Signature |
|------|----------|----------|
| AdminChitsScreen.kt | `AdminChitCard` | private fun AdminChitCard( |
| AdminChitsScreen.kt | `AdminChitsScreen` | fun AdminChitsScreen( |
| AdminChitsScreen.kt | `BulkActionBar` | private fun BulkActionBar( |
| AdminChitsScreen.kt | `EmptyState` | private fun EmptyState() |
| AdminChitsScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| AdminChitsScreen.kt | `FilterBar` | private fun FilterBar( |
| AdminChitsScreen.kt | `LoadingState` | private fun LoadingState() |
| AdminChitsScreen.kt | `PaginationControls` | private fun PaginationControls( |
| AdminChitsScreen.kt | `StatusBadge` | private fun StatusBadge(status: String) |
| AdminChitsScreen.kt | `TagChip` | private fun TagChip(tag: String) |
| AdminChitsScreen.kt | `formatDate` | private fun formatDate(dateStr: String): String |
| AdminChitsScreen.kt | `formatStatusLabel` | private fun formatStatusLabel(status: String): String |
| AdminChitsViewModel.kt | `bulkChangeOwner` | fun bulkChangeOwner(newOwner: String) |
| AdminChitsViewModel.kt | `bulkChangePriority` | fun bulkChangePriority(newPriority: String) |
| AdminChitsViewModel.kt | `bulkChangeStatus` | fun bulkChangeStatus(newStatus: String) |
| AdminChitsViewModel.kt | `bulkDelete` | fun bulkDelete() |
| AdminChitsViewModel.kt | `bulkUndelete` | fun bulkUndelete() |
| AdminChitsViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| AdminChitsViewModel.kt | `clearSelection` | fun clearSelection() |
| AdminChitsViewModel.kt | `enterSelectionMode` | fun enterSelectionMode(chitId: String) |
| AdminChitsViewModel.kt | `loadChits` | fun loadChits() |
| AdminChitsViewModel.kt | `nextPage` | fun nextPage() |
| AdminChitsViewModel.kt | `previousPage` | fun previousPage() |
| AdminChitsViewModel.kt | `setOwnerFilter` | fun setOwnerFilter(owner: String) |
| AdminChitsViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| AdminChitsViewModel.kt | `setShowDeleted` | fun setShowDeleted(show: Boolean) |
| AdminChitsViewModel.kt | `setStatusFilter` | fun setStatusFilter(status: String) |
| AdminChitsViewModel.kt | `toggleSelection` | fun toggleSelection(chitId: String) |

## ui/screens/alerts/

| File | Function | Signature |
|------|----------|----------|
| AlarmFiredActivity.kt | `AlarmFiredScreen` | private fun AlarmFiredScreen( |
| AlarmFiredActivity.kt | `getCurrentTimeFormatted` | private fun getCurrentTimeFormatted(): String |
| AlarmFiredActivity.kt | `onCreate` | override fun onCreate(savedInstanceState: Bundle?) |
| AlarmFiredActivity.kt | `onDestroy` | override fun onDestroy() |
| AlarmFiredActivity.kt | `scheduleSnooze` | private fun scheduleSnooze(chitId: String, title: String, minutes: Int) |
| AlarmFiredActivity.kt | `startAlarmSound` | private fun startAlarmSound() |
| AlarmFiredActivity.kt | `startVibration` | private fun startVibration() |
| AlarmFiredActivity.kt | `stopAlarm` | private fun stopAlarm() |
| AlertsScreen.kt | `AlertsScreen` | fun AlertsScreen( |
| AlertsScreen.kt | `ModeToggleRow` | private fun ModeToggleRow( |
| AlertsViewModel.kt | `acceptNotification` | fun acceptNotification(id: String) |
| AlertsViewModel.kt | `archiveReminder` | fun archiveReminder(chitId: String) |
| AlertsViewModel.kt | `cancelComplete` | fun cancelComplete(chitId: String) |
| AlertsViewModel.kt | `clearAddressed` | fun clearAddressed() |
| AlertsViewModel.kt | `clearNotificationError` | fun clearNotificationError() |
| AlertsViewModel.kt | `completeReminder` | fun completeReminder(chitId: String) |
| AlertsViewModel.kt | `createAlarm` | fun createAlarm() |
| AlertsViewModel.kt | `createStopwatch` | fun createStopwatch() |
| AlertsViewModel.kt | `createTimer` | fun createTimer() |
| AlertsViewModel.kt | `declineNotification` | fun declineNotification(id: String) |
| AlertsViewModel.kt | `deleteNotification` | fun deleteNotification(id: String) |
| AlertsViewModel.kt | `deleteReminder` | fun deleteReminder(chitId: String) |
| AlertsViewModel.kt | `deleteStandaloneAlert` | fun deleteStandaloneAlert(id: String) |
| AlertsViewModel.kt | `dismissNotification` | fun dismissNotification(id: String) |
| AlertsViewModel.kt | `fetchNotifications` | private fun fetchNotifications() |
| AlertsViewModel.kt | `getAddressedNotifications` | fun getAddressedNotifications(): List<NotificationDto> |
| AlertsViewModel.kt | `getOrCreateStopwatchRuntime` | fun getOrCreateStopwatchRuntime(alertId: String): StopwatchRuntime |
| AlertsViewModel.kt | `getOrCreateTimerRuntime` | fun getOrCreateTimerRuntime(alertId: String): TimerRuntime |
| AlertsViewModel.kt | `getPastReminders` | fun getPastReminders(): List<ChitEntity> |
| AlertsViewModel.kt | `getTimerName` | private fun getTimerName(alertId: String): String? |
| AlertsViewModel.kt | `getUnreadNotifications` | fun getUnreadNotifications(): List<NotificationDto> |
| AlertsViewModel.kt | `getUpcomingReminders` | fun getUpcomingReminders(): List<ChitEntity> |
| AlertsViewModel.kt | `loadDataForMode` | private fun loadDataForMode(mode: String) |
| AlertsViewModel.kt | `loadPersistedMode` | private fun loadPersistedMode(): String |
| AlertsViewModel.kt | `observeTimerForNotification` | private fun observeTimerForNotification(alertId: String, runtime: TimerRuntime) |
| AlertsViewModel.kt | `refresh` | fun refresh() |
| AlertsViewModel.kt | `removeStopwatchRuntime` | fun removeStopwatchRuntime(alertId: String) |
| AlertsViewModel.kt | `removeTimerRuntime` | fun removeTimerRuntime(alertId: String) |
| AlertsViewModel.kt | `setMode` | fun setMode(mode: String) |
| AlertsViewModel.kt | `snoozeNotification` | fun snoozeNotification(id: String, minutes: Int) |
| AlertsViewModel.kt | `startChitsCollection` | private fun startChitsCollection() |
| AlertsViewModel.kt | `startIndependentCollection` | private fun startIndependentCollection() |
| AlertsViewModel.kt | `startRemindersCollection` | private fun startRemindersCollection() |
| AlertsViewModel.kt | `toggleReminderPin` | fun toggleReminderPin(chitId: String) |
| AlertsViewModel.kt | `updateNotificationStatusLocally` | private fun updateNotificationStatusLocally(id: String, newStatus: String) |
| AlertsViewModel.kt | `updateStandaloneAlert` | fun updateStandaloneAlert(id: String, body: Map<String, Any?>) |
| ChitAlertsListView.kt | `ChitAlertCard` | private fun ChitAlertCard( |
| ChitAlertsListView.kt | `ChitAlertsListView` | fun ChitAlertsListView( |
| ChitAlertsListView.kt | `buildAlertSummaryParts` | private fun buildAlertSummaryParts(counts: AlertCounts): List<String> |
| ChitAlertsListView.kt | `parseAlertCounts` | private fun parseAlertCounts( |
| IndependentAlarmCard.kt | `IndependentAlarmCard` | fun IndependentAlarmCard( |
| IndependentAlarmCard.kt | `formatAlarmTime` | private fun formatAlarmTime(time: String, timeFormat: String): String |
| IndependentAlarmCard.kt | `saveAlarm` | private fun saveAlarm( |
| IndependentAlertsBoard.kt | `EmptyStateText` | private fun EmptyStateText(message: String) |
| IndependentAlertsBoard.kt | `IndependentAlertsBoard` | fun IndependentAlertsBoard( |
| IndependentAlertsBoard.kt | `SectionHeader` | private fun SectionHeader( |
| IndependentStopwatchCard.kt | `IndependentStopwatchCard` | fun IndependentStopwatchCard( |
| IndependentTimerCard.kt | `DurationInputRow` | private fun DurationInputRow( |
| IndependentTimerCard.kt | `IndependentTimerCard` | fun IndependentTimerCard( |
| IndependentTimerCard.kt | `TimerDoneBar` | private fun TimerDoneBar() |
| IndependentTimerCard.kt | `TimerProgressBar` | private fun TimerProgressBar( |
| IndependentTimerCard.kt | `formatRemainingTime` | private fun formatRemainingTime(remainingMs: Long): String |
| IndependentTimerCard.kt | `notifyDurationChange` | private fun notifyDurationChange( |
| NotificationsView.kt | `AcceptDeclinePill` | private fun AcceptDeclinePill( |
| NotificationsView.kt | `AddressedSectionHeader` | private fun AddressedSectionHeader(count: Int, onClearAddressed: () -> Unit) |
| NotificationsView.kt | `NotificationCard` | private fun NotificationCard( |
| NotificationsView.kt | `NotificationsView` | fun NotificationsView( |
| NotificationsView.kt | `SectionHeaderRow` | private fun SectionHeaderRow(title: String, count: Int) |
| NotificationsView.kt | `StatusBadge` | private fun StatusBadge(status: String) |
| NotificationsView.kt | `formatNotificationDate` | private fun formatNotificationDate(dateStr: String, timeFormat: String): String |
| RemindersView.kt | `ReminderCard` | private fun ReminderCard( |
| RemindersView.kt | `ReminderSectionHeader` | private fun ReminderSectionHeader(title: String, count: Int) |
| RemindersView.kt | `RemindersView` | fun RemindersView( |
| RemindersView.kt | `formatPointInTime` | private fun formatPointInTime(pointInTime: String?, timeFormat: String): String |

## ui/screens/attachments/

| File | Function | Signature |
|------|----------|----------|
| AttachmentsScreen.kt | `AttachmentCard` | private fun AttachmentCard( |
| AttachmentsScreen.kt | `AttachmentsScreen` | fun AttachmentsScreen( |
| AttachmentsScreen.kt | `EmptyState` | private fun EmptyState() |
| AttachmentsScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| AttachmentsScreen.kt | `FilterBar` | private fun FilterBar( |
| AttachmentsScreen.kt | `LoadingState` | private fun LoadingState() |
| AttachmentsScreen.kt | `PreviewDialog` | private fun PreviewDialog( |
| AttachmentsScreen.kt | `formatDate` | private fun formatDate(dateStr: String): String |
| AttachmentsScreen.kt | `formatFileSize` | private fun formatFileSize(bytes: Long): String |
| AttachmentsScreen.kt | `getTypeIcon` | private fun getTypeIcon(contentType: String): ImageVector |
| AttachmentsViewModel.kt | `bulkDelete` | fun bulkDelete() |
| AttachmentsViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| AttachmentsViewModel.kt | `enterMultiSelectMode` | fun enterMultiSelectMode(attachmentId: String) |
| AttachmentsViewModel.kt | `exitMultiSelectMode` | fun exitMultiSelectMode() |
| AttachmentsViewModel.kt | `getDownloadUrl` | fun getDownloadUrl(attachment: AttachmentItem): String |
| AttachmentsViewModel.kt | `getFilteredAttachments` | fun getFilteredAttachments(): List<AttachmentItem> |
| AttachmentsViewModel.kt | `getServerUrl` | fun getServerUrl(): String |
| AttachmentsViewModel.kt | `loadAttachments` | fun loadAttachments() |
| AttachmentsViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| AttachmentsViewModel.kt | `setSizeMax` | fun setSizeMax(mb: Float?) |
| AttachmentsViewModel.kt | `setSizeMin` | fun setSizeMin(mb: Float?) |
| AttachmentsViewModel.kt | `setSortOrder` | fun setSortOrder(sort: AttachmentSort) |
| AttachmentsViewModel.kt | `setTypeFilter` | fun setTypeFilter(filter: AttachmentTypeFilter) |
| AttachmentsViewModel.kt | `toggleSelection` | fun toggleSelection(attachmentId: String) |

## ui/screens/auditlog/

| File | Function | Signature |
|------|----------|----------|
| AuditLogScreen.kt | `ActionBadge` | private fun ActionBadge(action: String) |
| AuditLogScreen.kt | `ActorFilterDropdown` | private fun ActorFilterDropdown( |
| AuditLogScreen.kt | `AuditDatePickerDialog` | private fun AuditDatePickerDialog( |
| AuditLogScreen.kt | `AuditEntryCard` | private fun AuditEntryCard( |
| AuditLogScreen.kt | `AuditLogScreen` | fun AuditLogScreen( |
| AuditLogScreen.kt | `ChangeRow` | private fun ChangeRow(change: AuditChange) |
| AuditLogScreen.kt | `DateRangeRow` | private fun DateRangeRow( |
| AuditLogScreen.kt | `EmptyState` | private fun EmptyState() |
| AuditLogScreen.kt | `EntityTypeFilterRow` | private fun EntityTypeFilterRow( |
| AuditLogScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| AuditLogScreen.kt | `FilterControlsRow` | private fun FilterControlsRow( |
| AuditLogScreen.kt | `LoadingState` | private fun LoadingState() |
| AuditLogScreen.kt | `PageSizeDropdown` | private fun PageSizeDropdown( |
| AuditLogScreen.kt | `PaginationControls` | private fun PaginationControls( |
| AuditLogScreen.kt | `PruneAuditDialog` | private fun PruneAuditDialog( |
| AuditLogScreen.kt | `SortDropdown` | private fun SortDropdown( |
| AuditLogScreen.kt | `buildChangeText` | private fun buildChangeText(change: AuditChange): String |
| AuditLogScreen.kt | `formatDateLabel` | private fun formatDateLabel(dateStr: String): String |
| AuditLogScreen.kt | `formatTimestamp` | private fun formatTimestamp(timestamp: String): String |
| AuditLogViewModel.kt | `exportCsv` | fun exportCsv() |
| AuditLogViewModel.kt | `loadEntries` | fun loadEntries() |
| AuditLogViewModel.kt | `nextPage` | fun nextPage() |
| AuditLogViewModel.kt | `previousPage` | fun previousPage() |
| AuditLogViewModel.kt | `pruneEntries` | fun pruneEntries(olderThanDays: Int) |
| AuditLogViewModel.kt | `revertEntry` | fun revertEntry(entryId: String) |
| AuditLogViewModel.kt | `setActorFilter` | fun setActorFilter(actor: String) |
| AuditLogViewModel.kt | `setDateRange` | fun setDateRange(since: String?, until: String?) |
| AuditLogViewModel.kt | `setEntityTypeFilter` | fun setEntityTypeFilter(type: String) |
| AuditLogViewModel.kt | `setPageSize` | fun setPageSize(size: Int) |
| AuditLogViewModel.kt | `setSort` | fun setSort(sortBy: String, sortOrder: String) |

## ui/screens/calendar/

| File | Function | Signature |
|------|----------|----------|
| CalendarItineraryView.kt | `ItineraryDayHeader` | private fun ItineraryDayHeader(date: LocalDate) |
| CalendarItineraryView.kt | `ItineraryEmptyState` | private fun ItineraryEmptyState() |
| CalendarItineraryView.kt | `ItineraryEventCard` | private fun ItineraryEventCard( |
| CalendarItineraryView.kt | `ItineraryView` | fun ItineraryView( |
| CalendarItineraryView.kt | `buildItineraryTimeText` | private fun buildItineraryTimeText(event: ChitEntity): String |
| CalendarItineraryView.kt | `groupEventsByDay` | private fun groupEventsByDay(events: List<ChitEntity>): List<Pair<LocalDate, List<ChitEntity>>> |
| CalendarItineraryView.kt | `parseItineraryColor` | private fun parseItineraryColor(colorString: String): Color |
| CalendarMonthView.kt | `MonthDayCellView` | private fun MonthDayCellView( |
| CalendarMonthView.kt | `MonthView` | fun MonthView( |
| CalendarMonthView.kt | `buildDayHeaders` | private fun buildDayHeaders(startDayOfWeek: DayOfWeek): List<String> |
| CalendarMonthView.kt | `buildMonthGrid` | private fun buildMonthGrid( |
| CalendarMonthView.kt | `groupEventsByDate` | private fun groupEventsByDate(events: List<ChitEntity>): Map<LocalDate, List<ChitEntity>> |
| CalendarMonthView.kt | `parseEventColor` | private fun parseEventColor(colorString: String): Color |
| CalendarMonthView.kt | `parseWeekStartDay` | private fun parseWeekStartDay(weekStartDay: String): DayOfWeek |
| CalendarScreen.kt | `CalendarScreen` | fun CalendarScreen( |
| CalendarScreen.kt | `EventCard` | private fun EventCard(event: ChitEntity, onTap: () -> Unit |
| CalendarScreen.kt | `EventList` | private fun EventList( |
| CalendarScreen.kt | `buildTimeText` | private fun buildTimeText(event: ChitEntity): String |
| CalendarScreen.kt | `parseColor` | private fun parseColor(colorString: String): Color |
| CalendarTimeGrid.kt | `AllDayEventChip` | private fun AllDayEventChip( |
| CalendarTimeGrid.kt | `DayEventCard` | private fun DayEventCard( |
| CalendarTimeGrid.kt | `DayTimeGrid` | fun DayTimeGrid( |
| CalendarTimeGrid.kt | `WeekEventChip` | private fun WeekEventChip( |
| CalendarTimeGrid.kt | `WeekTimeGrid` | fun WeekTimeGrid( |
| CalendarTimeGrid.kt | `buildEventTimeLabel` | private fun buildEventTimeLabel(info: CalendarDateInfo, timeFormat: String): String |
| CalendarTimeGrid.kt | `calculateOverlapLayout` | private fun calculateOverlapLayout( |
| CalendarTimeGrid.kt | `eventMatchesDay` | private fun eventMatchesDay(info: CalendarDateInfo, day: LocalDate): Boolean |
| CalendarTimeGrid.kt | `fmtTime` | private fun fmtTime(dt: LocalDateTime, timeFormat: String): String |
| CalendarTimeGrid.kt | `formatHourLabel` | private fun formatHourLabel(hour: Int, timeFormat: String): String |
| CalendarTimeGrid.kt | `getCalendarDateInfoForEvent` | private fun getCalendarDateInfoForEvent(event: ChitEntity): CalendarDateInfo |
| CalendarTimeGrid.kt | `isDeclinedByUser` | private fun isDeclinedByUser(event: ChitEntity, currentUsername: String?): Boolean |
| CalendarTimeGrid.kt | `parseDateTime` | private fun parseDateTime(dateStr: String?): LocalDateTime? |
| CalendarTimeGrid.kt | `persistDragMove` | private fun persistDragMove( |
| CalendarTimeGrid.kt | `snapToGrid` | private fun snapToGrid(minutes: Int, snapMinutes: Int): Int |
| CalendarViewModel.kt | `getDateRange` | private fun getDateRange(date: LocalDate, mode: CalendarViewMode, xDayCount: Int): Pair<String, String> |
| CalendarViewModel.kt | `goToToday` | fun goToToday() |
| CalendarViewModel.kt | `loadEvents` | private fun loadEvents() |
| CalendarViewModel.kt | `nextPeriod` | fun nextPeriod() |
| CalendarViewModel.kt | `parseLocalDateTime` | private fun parseLocalDateTime(dateStr: String?): LocalDateTime? |
| CalendarViewModel.kt | `parseRecurrenceExceptions` | private fun parseRecurrenceExceptions(json: String?): List<RecurrenceException> |
| CalendarViewModel.kt | `parseRecurrenceRule` | private fun parseRecurrenceRule(json: String?): RecurrenceRule? |
| CalendarViewModel.kt | `persistViewMode` | private fun persistViewMode(mode: CalendarViewMode) |
| CalendarViewModel.kt | `previousPeriod` | fun previousPeriod() |
| CalendarViewModel.kt | `setDate` | fun setDate(date: LocalDate) |
| CalendarViewModel.kt | `setMonthMode` | fun setMonthMode(mode: String) |
| CalendarViewModel.kt | `setViewMode` | fun setViewMode(mode: CalendarViewMode) |
| CalendarViewModel.kt | `updateChitDateTimes` | fun updateChitDateTimes( |
| CalendarXDayView.kt | `DayColumn` | private fun DayColumn( |
| CalendarXDayView.kt | `DayHeader` | private fun DayHeader( |
| CalendarXDayView.kt | `XDayEventCard` | private fun XDayEventCard( |
| CalendarXDayView.kt | `XDayView` | fun XDayView( |
| CalendarXDayView.kt | `buildEventTimeText` | private fun buildEventTimeText(event: ChitEntity): String |
| CalendarXDayView.kt | `groupEventsByDate` | private fun groupEventsByDate( |
| CalendarXDayView.kt | `parseEventColor` | private fun parseEventColor(colorString: String): Color |
| CalendarXDayView.kt | `parseEventDate` | private fun parseEventDate(event: ChitEntity): LocalDate? |
| CalendarYearView.kt | `DayCell` | private fun DayCell( |
| CalendarYearView.kt | `MiniMonthGrid` | private fun MiniMonthGrid( |
| CalendarYearView.kt | `YearView` | fun YearView( |
| CalendarYearView.kt | `getOrderedDaysOfWeek` | private fun getOrderedDaysOfWeek(firstDayOfWeek: DayOfWeek): List<DayOfWeek> |
| CalendarYearView.kt | `getStartOffset` | private fun getStartOffset(firstDayOfMonth: DayOfWeek, firstDayOfWeek: DayOfWeek): Int |
| CalendarYearView.kt | `parseToLocalDate` | private fun parseToLocalDate(datetime: String): LocalDate? |
| CalendarYearView.kt | `parseWeekStartDay` | private fun parseWeekStartDay(weekStartDay: String): DayOfWeek |

## ui/screens/checklists/

| File | Function | Signature |
|------|----------|----------|
| ChecklistsScreen.kt | `ChecklistChitCard` | private fun ChecklistChitCard( |
| ChecklistsScreen.kt | `ChecklistItemRow` | private fun ChecklistItemRow( |
| ChecklistsScreen.kt | `ChecklistsScreen` | fun ChecklistsScreen( |
| ChecklistsScreen.kt | `EmptyChecklistsState` | private fun EmptyChecklistsState() |
| ChecklistsScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState( |
| ChecklistsViewModel.kt | `reorderItem` | fun reorderItem(chitId: String, fromIndex: Int, toIndex: Int) |
| ChecklistsViewModel.kt | `toggleItem` | fun toggleItem(chitId: String, itemIndex: Int) |

## ui/screens/contacts/

| File | Function | Signature |
|------|----------|----------|
| ContactEditorScreen.kt | `ContactDatesZone` | private fun ContactDatesZone( |
| ContactEditorScreen.kt | `ContactEditorScreen` | fun ContactEditorScreen( |
| ContactEditorScreen.kt | `ContactInfoZone` | private fun ContactInfoZone( |
| ContactEditorScreen.kt | `ContactNotesZone` | private fun ContactNotesZone( |
| ContactEditorScreen.kt | `ContactProfileImageSection` | private fun ContactProfileImageSection( |
| ContactEditorScreen.kt | `ContactTagsZone` | private fun ContactTagsZone( |
| ContactEditorScreen.kt | `DetailsZone` | private fun DetailsZone( |
| ContactEditorScreen.kt | `MultiValueField` | private fun MultiValueField( |
| ContactEditorScreen.kt | `NameSection` | private fun NameSection( |
| ContactEditorScreen.kt | `SecurityZone` | private fun SecurityZone( |
| ContactEditorScreen.kt | `SocialWebZone` | private fun SocialWebZone( |
| ContactEditorScreen.kt | `addMulti` | fun addMulti(prop: String, json: String) |
| ContactEditorScreen.kt | `countMultiValueItems` | private fun countMultiValueItems(json: String): Int |
| ContactEditorScreen.kt | `openAddressInMaps` | private fun openAddressInMaps(context: android.content.Context, address: String) |
| ContactEditorScreen.kt | `openSignalMessage` | private fun openSignalMessage(context: android.content.Context, signalValue: String) |
| ContactEditorScreen.kt | `parseDateEntries` | private fun parseDateEntries(json: String): List<DateEntry> |
| ContactEditorScreen.kt | `parseMultiValueEntries` | private fun parseMultiValueEntries(json: String): List<MultiValueEntry> |
| ContactEditorScreen.kt | `serializeDateEntries` | private fun serializeDateEntries(entries: List<DateEntry>): String |
| ContactEditorScreen.kt | `serializeMultiValueEntries` | private fun serializeMultiValueEntries(entries: List<MultiValueEntry>): String |
| ContactEditorScreen.kt | `shareContactAsVCard` | private fun shareContactAsVCard(context: android.content.Context, form: ContactFormState) |
| ContactEditorViewModel.kt | `applyNewContactDefaults` | private fun applyNewContactDefaults() |
| ContactEditorViewModel.kt | `delete` | fun delete() |
| ContactEditorViewModel.kt | `discard` | fun discard() |
| ContactEditorViewModel.kt | `loadCustomColors` | private fun loadCustomColors() |
| ContactEditorViewModel.kt | `loadExistingContact` | private fun loadExistingContact() |
| ContactEditorViewModel.kt | `loadProfile` | private fun loadProfile() |
| ContactEditorViewModel.kt | `save` | fun save() |
| ContactEditorViewModel.kt | `saveProfile` | private fun saveProfile() |
| ContactEditorViewModel.kt | `updateField` | fun updateField(updater: (ContactFormState) -> ContactFormState) |
| ContactEditorViewModel.kt | `updateForm` | fun updateForm(newState: ContactFormState) |
| ContactListScreen.kt | `ContactListScreen` | fun ContactListScreen( |
| ContactListScreen.kt | `ContactRow` | private fun ContactRow( |
| ContactListScreen.kt | `GroupedContactList` | private fun GroupedContactList( |
| ContactListScreen.kt | `UserRow` | private fun UserRow( |
| ContactListViewModel.kt | `clearError` | fun clearError() |
| ContactListViewModel.kt | `clearExportSuccess` | fun clearExportSuccess() |
| ContactListViewModel.kt | `clearExportedFile` | fun clearExportedFile() |
| ContactListViewModel.kt | `clearImportResult` | fun clearImportResult() |
| ContactListViewModel.kt | `exportContacts` | fun exportContacts(format: String) |
| ContactListViewModel.kt | `getFilenameFromUri` | private fun getFilenameFromUri(uri: Uri): String? |
| ContactListViewModel.kt | `importFile` | fun importFile(uri: Uri) |
| ContactListViewModel.kt | `isSectionCollapsed` | fun isSectionCollapsed(sectionId: String): Boolean |
| ContactListViewModel.kt | `isUserFavorite` | fun isUserFavorite(userId: String): Boolean |
| ContactListViewModel.kt | `loadCollapsedSections` | private fun loadCollapsedSections(): Set<String> |
| ContactListViewModel.kt | `loadSwitchableUsers` | private fun loadSwitchableUsers() |
| ContactListViewModel.kt | `observeContacts` | private fun observeContacts() |
| ContactListViewModel.kt | `saveCollapsedSections` | private fun saveCollapsedSections(sections: Set<String>) |
| ContactListViewModel.kt | `toggleFavorite` | fun toggleFavorite(contactId: String) |
| ContactListViewModel.kt | `toggleGroupedMode` | fun toggleGroupedMode() |
| ContactListViewModel.kt | `toggleSection` | fun toggleSection(sectionId: String) |
| ContactListViewModel.kt | `toggleUserFavorite` | fun toggleUserFavorite(userId: String) |
| ContactListViewModel.kt | `updateGroupedState` | private fun updateGroupedState(contactList: List<ContactEntity>) |
| ContactListViewModel.kt | `updateSearchQuery` | fun updateSearchQuery(query: String) |
| ContactTrashScreen.kt | `ContactTrashScreen` | fun ContactTrashScreen( |
| ContactTrashScreen.kt | `TrashContactRow` | private fun TrashContactRow( |
| ContactTrashScreen.kt | `formatTrashDate` | private fun formatTrashDate(iso: String): String |
| ContactTrashViewModel.kt | `bulkPurge` | fun bulkPurge() |
| ContactTrashViewModel.kt | `bulkRestore` | fun bulkRestore() |
| ContactTrashViewModel.kt | `clearMessage` | fun clearMessage() |
| ContactTrashViewModel.kt | `deselectAll` | fun deselectAll() |
| ContactTrashViewModel.kt | `isAllSelected` | fun isAllSelected(contacts: List<ContactEntity>): Boolean |
| ContactTrashViewModel.kt | `isSelected` | fun isSelected(contactId: String): Boolean = contactId in _uiState.value.selectedIds |
| ContactTrashViewModel.kt | `purgeContact` | fun purgeContact(contactId: String) |
| ContactTrashViewModel.kt | `restoreContact` | fun restoreContact(contactId: String) |
| ContactTrashViewModel.kt | `selectAll` | fun selectAll(contacts: List<ContactEntity>) |
| ContactTrashViewModel.kt | `toggleSelectAll` | fun toggleSelectAll(contacts: List<ContactEntity>) |
| ContactTrashViewModel.kt | `toggleSelection` | fun toggleSelection(contactId: String) |

## ui/screens/customobjects/

| File | Function | Signature |
|------|----------|----------|
| CustomObjectsScreen.kt | `AddObjectsPickerDialog` | private fun AddObjectsPickerDialog( |
| CustomObjectsScreen.kt | `CreateZoneDialog` | private fun CreateZoneDialog( |
| CustomObjectsScreen.kt | `CustomObjectsScreen` | fun CustomObjectsScreen( |
| CustomObjectsScreen.kt | `CustomZonesSection` | private fun CustomZonesSection( |
| CustomObjectsScreen.kt | `EditObjectDialog` | private fun EditObjectDialog( |
| CustomObjectsScreen.kt | `FilterToolbar` | private fun FilterToolbar( |
| CustomObjectsScreen.kt | `IndicatorsZoneSection` | private fun IndicatorsZoneSection(indicators: List<ZoneObject>) |
| CustomObjectsScreen.kt | `ObjectRow` | private fun ObjectRow( |
| CustomObjectsScreen.kt | `TypeGroupSection` | private fun TypeGroupSection( |
| CustomObjectsScreen.kt | `ZoneEditorDialog` | private fun ZoneEditorDialog( |
| CustomObjectsScreen.kt | `ZoneObjectCard` | private fun ZoneObjectCard( |
| CustomObjectsViewModel.kt | `addObjectToZone` | fun addObjectToZone(objectId: String, zoneId: String, sortOrder: Int = 0) |
| CustomObjectsViewModel.kt | `applyFilters` | private fun applyFilters() |
| CustomObjectsViewModel.kt | `clearError` | fun clearError() |
| CustomObjectsViewModel.kt | `createObject` | fun createObject( |
| CustomObjectsViewModel.kt | `createZone` | fun createZone(name: String, onSuccess: (CustomZone) -> Unit |
| CustomObjectsViewModel.kt | `deleteObject` | fun deleteObject(id: String) |
| CustomObjectsViewModel.kt | `deleteZone` | fun deleteZone(zoneId: String) |
| CustomObjectsViewModel.kt | `getAvailableObjectsForZone` | fun getAvailableObjectsForZone(zoneId: String): List<CustomObject> |
| CustomObjectsViewModel.kt | `getAvailableTypes` | fun getAvailableTypes(): List<String> |
| CustomObjectsViewModel.kt | `getBaseUrl` | private fun getBaseUrl(): String? |
| CustomObjectsViewModel.kt | `loadAll` | fun loadAll() |
| CustomObjectsViewModel.kt | `loadZoneObjects` | fun loadZoneObjects(zoneId: String) |
| CustomObjectsViewModel.kt | `removeObjectFromZone` | fun removeObjectFromZone(objectId: String, zoneId: String) |
| CustomObjectsViewModel.kt | `renameZone` | fun renameZone(zoneId: String, newName: String) |
| CustomObjectsViewModel.kt | `reorderIndicators` | fun reorderIndicators(orderedObjectIds: List<String>) |
| CustomObjectsViewModel.kt | `reorderZoneObjects` | fun reorderZoneObjects(zoneId: String, orderedObjectIds: List<String>) |
| CustomObjectsViewModel.kt | `reorderZones` | fun reorderZones(orderedZoneIds: List<String>) |
| CustomObjectsViewModel.kt | `restoreObject` | fun restoreObject(id: String) |
| CustomObjectsViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| CustomObjectsViewModel.kt | `setTypeFilter` | fun setTypeFilter(type: String) |
| CustomObjectsViewModel.kt | `toggleActive` | fun toggleActive(objectId: String, newActive: Boolean) |
| CustomObjectsViewModel.kt | `updateObject` | fun updateObject( |

## ui/screens/editor/

| File | Function | Signature |
|------|----------|----------|
| ChitEditorScreen.kt | `ChipInputField` | private fun ChipInputField( |
| ChitEditorScreen.kt | `ChitEditorScreen` | fun ChitEditorScreen( |
| ChitEditorScreen.kt | `DropdownField` | private fun DropdownField( |
| ChitEditorScreen.kt | `FullEditorModal` | private fun FullEditorModal( |
| ChitEditorScreen.kt | `HealthIndicatorsZone` | private fun HealthIndicatorsZone( |
| ChitEditorScreen.kt | `LocationZone` | private fun LocationZone( |
| ChitEditorScreen.kt | `NotesFormatToolbar` | private fun NotesFormatToolbar( |
| ChitEditorScreen.kt | `NotesZone` | private fun NotesZone( |
| ChitEditorScreen.kt | `PeopleZone` | private fun PeopleZone( |
| ChitEditorScreen.kt | `PrerequisitesZone` | private fun PrerequisitesZone( |
| ChitEditorScreen.kt | `ProjectsZone` | private fun ProjectsZone( |
| ChitEditorScreen.kt | `SeriesLogZone` | private fun SeriesLogZone(chitId: String) |
| ChitEditorScreen.kt | `TagsZone` | private fun TagsZone( |
| ChitEditorScreen.kt | `TitleMetadataRow` | private fun TitleMetadataRow(formState: ChitFormState) |
| ChitEditorScreen.kt | `autoListContinuation` | private fun autoListContinuation(oldText: String, newText: String): String |
| ChitEditorScreen.kt | `buildShareText` | private fun buildShareText(form: ChitFormState): String |
| ChitEditorScreen.kt | `contrastTextColorLocal` | private fun contrastTextColorLocal(background: Color): Color |
| ChitEditorScreen.kt | `getLatestValue` | private fun getLatestValue(value: Any?): String |
| ChitEditorScreen.kt | `parseTagColorLocal` | private fun parseTagColorLocal(hex: String): Color |
| ChitEditorScreen.kt | `prependLine` | private fun prependLine(text: String, prefix: String): String |
| ChitEditorScreen.kt | `pushUndo` | fun pushUndo(oldValue: String) |
| ChitEditorScreen.kt | `walk` | fun walk(nodes: List<TagNode>) |
| ChitEditorScreen.kt | `wrapSelection` | private fun wrapSelection( |
| ChitEditorViewModel.kt | `cancelBack` | fun cancelBack() |
| ChitEditorViewModel.kt | `deleteChit` | fun deleteChit() |
| ChitEditorViewModel.kt | `discard` | fun discard() |
| ChitEditorViewModel.kt | `discardAndExit` | fun discardAndExit() |
| ChitEditorViewModel.kt | `discardEmailDraft` | fun discardEmailDraft() |
| ChitEditorViewModel.kt | `dismissConflict` | fun dismissConflict() |
| ChitEditorViewModel.kt | `duplicateChit` | fun duplicateChit() |
| ChitEditorViewModel.kt | `loadChildChitSummaries` | fun loadChildChitSummaries(childIds: List<String>?) |
| ChitEditorViewModel.kt | `loadContactNames` | private fun loadContactNames() |
| ChitEditorViewModel.kt | `loadEditorSettings` | private fun loadEditorSettings() |
| ChitEditorViewModel.kt | `loadExistingChit` | private fun loadExistingChit() |
| ChitEditorViewModel.kt | `loadIndicatorObjects` | private fun loadIndicatorObjects() |
| ChitEditorViewModel.kt | `loadRecentTags` | private fun loadRecentTags() |
| ChitEditorViewModel.kt | `loadTagTree` | private fun loadTagTree() |
| ChitEditorViewModel.kt | `onBackPressed` | fun onBackPressed() |
| ChitEditorViewModel.kt | `onTagCreated` | fun onTagCreated(tagName: String) |
| ChitEditorViewModel.kt | `parseConflictFields` | private fun parseConflictFields(json: String?): List<String> |
| ChitEditorViewModel.kt | `registerOnDiscardCallback` | fun registerOnDiscardCallback(callback: suspend () -> Unit) |
| ChitEditorViewModel.kt | `registerOnSaveCallback` | fun registerOnSaveCallback(callback: suspend () -> Unit) |
| ChitEditorViewModel.kt | `save` | fun save() |
| ChitEditorViewModel.kt | `saveAndExit` | fun saveAndExit() |
| ChitEditorViewModel.kt | `saveAndStay` | fun saveAndStay() |
| ChitEditorViewModel.kt | `searchChitTitles` | fun searchChitTitles(query: String) |
| ChitEditorViewModel.kt | `sendEmail` | fun sendEmail() |
| ChitEditorViewModel.kt | `trackRecentTag` | fun trackRecentTag(tagPath: String) |
| ChitEditorViewModel.kt | `updateChildChitStatus` | fun updateChildChitStatus(childId: String, newStatus: String) |
| ChitEditorViewModel.kt | `updateForm` | fun updateForm(newState: ChitFormState) |
| EditorZoneState.kt | `buildDatesText` | private fun buildDatesText(formState: ChitFormState): String |
| EditorZoneState.kt | `buildOverviewRows` | fun buildOverviewRows(formState: ChitFormState): List<com.cwoc.app.ui.screens.editor.zones.OverviewRow> |
| EditorZoneState.kt | `getStartingZoneIndex` | fun getStartingZoneIndex(sourceTab: String?, hasDatePrefill: Boolean): Int |
| EditorZoneState.kt | `isZoneEmpty` | fun isZoneEmpty(zoneId: String, formState: ChitFormState): Boolean |
| EditorZoneState.kt | `navigateTo` | fun navigateTo(index: Int) |
| EditorZoneState.kt | `navigateToZoneId` | fun navigateToZoneId(zoneId: String) |
| EditorZoneState.kt | `nextZone` | fun nextZone() |
| EditorZoneState.kt | `prevZone` | fun prevZone() |
| EditorZoneState.kt | `rememberEditorZoneState` | fun rememberEditorZoneState( |
| EditorZoneState.kt | `updateVisibleZones` | fun updateVisibleZones(formState: ChitFormState) |

## ui/screens/editor/zones/

| File | Function | Signature |
|------|----------|----------|
| AlertsZone.kt | `AddAlertForm` | private fun AddAlertForm( |
| AlertsZone.kt | `AlertRow` | private fun AlertRow( |
| AlertsZone.kt | `AlertTypeSelector` | private fun AlertTypeSelector( |
| AlertsZone.kt | `AlertsZone` | fun AlertsZone( |
| AlertsZone.kt | `OffsetPicker` | private fun OffsetPicker( |
| AlertsZone.kt | `alertTypeIcon` | private fun alertTypeIcon(type: String): ImageVector |
| AlertsZone.kt | `alertTypeLabel` | private fun alertTypeLabel(type: String): String |
| AlertsZone.kt | `formatAlertDescription` | private fun formatAlertDescription(alert: AlertItem, timeFormat: String): String |
| AlertsZone.kt | `formatOffsetMinutes` | internal fun formatOffsetMinutes(minutes: Int): String |
| AlertsZone.kt | `formatTimeForDisplay` | private fun formatTimeForDisplay(timeStr: String, timeFormat: String): String |
| AlertsZone.kt | `parseAlertsJson` | internal fun parseAlertsJson(json: String?): List<AlertItem> |
| AlertsZone.kt | `parseTimeString` | private fun parseTimeString(timeStr: String): LocalTime? |
| AlertsZone.kt | `serializeAlerts` | internal fun serializeAlerts(alerts: List<AlertItem>): String? |
| AlertsZone.kt | `weatherConditionLabel` | private fun weatherConditionLabel(condition: String): String |
| AttachmentsZone.kt | `AttachmentRow` | private fun AttachmentRow( |
| AttachmentsZone.kt | `AttachmentsZone` | fun AttachmentsZone( |
| AttachmentsZone.kt | `formatFileSize` | private fun formatFileSize(bytes: Long): String |
| AttachmentsZone.kt | `getFileTypeIcon` | private fun getFileTypeIcon(filenameOrMime: String): ImageVector |
| AttachmentsZone.kt | `getFilenameFromUri` | private fun getFilenameFromUri(context: Context, uri: Uri): String? |
| AttachmentsZone.kt | `parseAttachments` | private fun parseAttachments(json: String?): List<AttachmentInfo> |
| ChecklistZone.kt | `ChecklistItemRow` | private fun ChecklistItemRow( |
| ChecklistZone.kt | `ChecklistZone` | fun ChecklistZone( |
| ChecklistZone.kt | `applyChange` | fun applyChange(newItems: List<ChecklistItem>) |
| ChecklistZone.kt | `performUndo` | fun performUndo() |
| ChecklistZoneV2.kt | `ChecklistAddItemInput` | private fun ChecklistAddItemInput( |
| ChecklistZoneV2.kt | `ChecklistCompletedSectionV2` | private fun ChecklistCompletedSectionV2( |
| ChecklistZoneV2.kt | `ChecklistDataMenuSheet` | private fun ChecklistDataMenuSheet( |
| ChecklistZoneV2.kt | `ChecklistItemRowV2` | private fun ChecklistItemRowV2( |
| ChecklistZoneV2.kt | `ChecklistMultiSelectToolbar` | private fun ChecklistMultiSelectToolbar( |
| ChecklistZoneV2.kt | `ChecklistZoneHeader` | private fun ChecklistZoneHeader( |
| ChecklistZoneV2.kt | `ChecklistZoneV2` | fun ChecklistZoneV2( |
| ChecklistZoneV2.kt | `DataMenuItem` | private fun DataMenuItem(icon: String, label: String, onClick: () -> Unit) |
| ChecklistZoneV2.kt | `ToolbarButton` | private fun ToolbarButton(label: String, onClick: () -> Unit) |
| ChecklistZoneViewModel.kt | `addItem` | fun addItem(text: String) |
| ChecklistZoneViewModel.kt | `applyChange` | fun applyChange(newItems: List<ChecklistItemV2>) |
| ChecklistZoneViewModel.kt | `applyChangeQuiet` | fun applyChangeQuiet(newItems: List<ChecklistItemV2>) |
| ChecklistZoneViewModel.kt | `checkSelected` | fun checkSelected() |
| ChecklistZoneViewModel.kt | `cleanUpEmptyItems` | fun cleanUpEmptyItems() |
| ChecklistZoneViewModel.kt | `clearCheckedItems` | fun clearCheckedItems() |
| ChecklistZoneViewModel.kt | `clearSelection` | fun clearSelection() |
| ChecklistZoneViewModel.kt | `clearUncheckedItems` | fun clearUncheckedItems() |
| ChecklistZoneViewModel.kt | `commitPendingContent` | fun commitPendingContent() |
| ChecklistZoneViewModel.kt | `deleteItem` | fun deleteItem(itemId: String) |
| ChecklistZoneViewModel.kt | `deleteSelected` | fun deleteSelected() |
| ChecklistZoneViewModel.kt | `getIncompleteAsMarkdown` | fun getIncompleteAsMarkdown(): String? |
| ChecklistZoneViewModel.kt | `hasPendingContent` | fun hasPendingContent(): Boolean |
| ChecklistZoneViewModel.kt | `indentItem` | fun indentItem(itemId: String) |
| ChecklistZoneViewModel.kt | `indentSelected` | fun indentSelected() |
| ChecklistZoneViewModel.kt | `indentSubtree` | fun indentSubtree(itemId: String) |
| ChecklistZoneViewModel.kt | `isAutoSaveActive` | private fun isAutoSaveActive(): Boolean |
| ChecklistZoneViewModel.kt | `loadItems` | fun loadItems(json: String?) |
| ChecklistZoneViewModel.kt | `moveAbove` | fun moveAbove(draggedId: String, targetId: String) |
| ChecklistZoneViewModel.kt | `moveBelow` | fun moveBelow(draggedId: String, targetId: String) |
| ChecklistZoneViewModel.kt | `moveChecklistToNote` | fun moveChecklistToNote(): String |
| ChecklistZoneViewModel.kt | `moveNoteToChecklist` | fun moveNoteToChecklist(noteText: String) |
| ChecklistZoneViewModel.kt | `moveOnto` | fun moveOnto(draggedId: String, targetId: String) |
| ChecklistZoneViewModel.kt | `notifyChange` | private fun notifyChange() |
| ChecklistZoneViewModel.kt | `outdentItem` | fun outdentItem(itemId: String) |
| ChecklistZoneViewModel.kt | `outdentSelected` | fun outdentSelected() |
| ChecklistZoneViewModel.kt | `outdentSubtree` | fun outdentSubtree(itemId: String) |
| ChecklistZoneViewModel.kt | `pasteItems` | fun pasteItems(text: String) |
| ChecklistZoneViewModel.kt | `pushUndoState` | private fun pushUndoState() |
| ChecklistZoneViewModel.kt | `rangeSelectTo` | fun rangeSelectTo(itemId: String) |
| ChecklistZoneViewModel.kt | `redo` | fun redo() |
| ChecklistZoneViewModel.kt | `selectAll` | fun selectAll() |
| ChecklistZoneViewModel.kt | `splitItem` | fun splitItem(itemId: String, cursorPos: Int): String |
| ChecklistZoneViewModel.kt | `toggleAutoSaveOverride` | fun toggleAutoSaveOverride() |
| ChecklistZoneViewModel.kt | `toggleCheck` | fun toggleCheck(itemId: String) |
| ChecklistZoneViewModel.kt | `toggleSelectItem` | fun toggleSelectItem(itemId: String) |
| ChecklistZoneViewModel.kt | `triggerAutoSave` | private fun triggerAutoSave() |
| ChecklistZoneViewModel.kt | `undo` | fun undo() |
| ChecklistZoneViewModel.kt | `updateItemText` | fun updateItemText(itemId: String, newText: String) |
| ColorZone.kt | `ColorSwatch` | private fun ColorSwatch( |
| ColorZone.kt | `ColorZone` | fun ColorZone( |
| ColorZone.kt | `getColorName` | private fun getColorName(hex: String): String |
| ColorZone.kt | `parseHexColor` | internal fun parseHexColor(hex: String): Color |
| DateZone.kt | `AllDayButton` | private fun AllDayButton(isActive: Boolean, isDisabled: Boolean, onClick: () -> Unit) |
| DateZone.kt | `DateZone` | fun DateZone( |
| DateZone.kt | `InlineRecurrenceRow` | private fun InlineRecurrenceRow( |
| DateZone.kt | `ParchmentDateField` | private fun ParchmentDateField( |
| DateZone.kt | `ParchmentTimeButton` | private fun ParchmentTimeButton( |
| DateZone.kt | `TimezoneLabel` | private fun TimezoneLabel( |
| DateZone.kt | `applyDateMode` | private fun applyDateMode( |
| DateZone.kt | `applyDefaultNotifications` | private fun applyDefaultNotifications( |
| DateZone.kt | `buildContextualFreqOptions` | private fun buildContextualFreqOptions(activeDate: LocalDate?): List<Pair<String, String>> |
| DateZone.kt | `buildHabitFreqOptions` | private fun buildHabitFreqOptions(): List<Pair<String, String>> |
| DateZone.kt | `deriveDateMode` | private fun deriveDateMode( |
| DateZone.kt | `formatDateForDisplay` | private fun formatDateForDisplay(value: String?): String |
| DateZone.kt | `formatDatetimeForDisplay` | internal fun formatDatetimeForDisplay(value: String?, allDay: Boolean, timeFormat: String): String |
| DateZone.kt | `formatTimeForDisplay` | private fun formatTimeForDisplay(value: String?, timeFormat: String): String |
| DateZone.kt | `getTimezoneAbbr` | private fun getTimezoneAbbr(tzId: String): String |
| DateZone.kt | `getTimezoneFullName` | private fun getTimezoneFullName(tzId: String): String |
| DateZone.kt | `parseIsoDatetime` | private fun parseIsoDatetime(value: String?): LocalDateTime? |
| DateZone.kt | `parseIsoDatetimeInternal` | private fun parseIsoDatetimeInternal(value: String?): LocalDateTime? |
| DateZone.kt | `snapMinute` | internal fun snapMinute(minute: Int, snapMinutes: Int): Int |
| DateZone.kt | `snapTime` | internal fun snapTime(time: LocalTime, snapMinutes: Int): LocalTime |
| EditorZoneHeader.kt | `EditorZoneHeader` | fun EditorZoneHeader( |
| EditorZoneNav.kt | `ActionsSidebar` | fun ActionsSidebar( |
| EditorZoneNav.kt | `EditorZoneNavHeader` | fun EditorZoneNavHeader( |
| EditorZoneNav.kt | `OverviewZoneContent` | fun OverviewZoneContent( |
| EditorZoneNav.kt | `UnsavedDot` | fun UnsavedDot(modifier: Modifier = Modifier) |
| EditorZoneNav.kt | `ZoneListPanel` | fun ZoneListPanel( |
| EditorZoneNav.kt | `contrastColor` | fun contrastColor(bg: Color): Color |
| EmailComposeZone.kt | `DraftComposeContent` | private fun DraftComposeContent( |
| EmailComposeZone.kt | `EmailComposeZone` | fun EmailComposeZone( |
| EmailComposeZone.kt | `ReadOnlyEmailField` | private fun ReadOnlyEmailField(label: String, value: String?) |
| EmailComposeZone.kt | `ReceivedEmailContent` | private fun ReceivedEmailContent( |
| EmailComposeZone.kt | `RecipientChipField` | private fun RecipientChipField( |
| EmailComposeZone.kt | `SentEmailContent` | private fun SentEmailContent( |
| EmailComposeZone.kt | `parseRecipients` | private fun parseRecipients(recipientString: String?): List<String> |
| HabitsZone.kt | `FrequencyDropdown` | private fun FrequencyDropdown( |
| HabitsZone.kt | `HabitStatsDisplay` | private fun HabitStatsDisplay( |
| HabitsZone.kt | `HabitsZone` | fun HabitsZone( |
| HabitsZone.kt | `ResetPeriodDropdown` | private fun ResetPeriodDropdown( |
| HabitsZone.kt | `calculateStreak` | internal fun calculateStreak(lastActionDate: String?, resetPeriod: String?): Int |
| HabitsZone.kt | `generateCompletionHistory` | private fun generateCompletionHistory(success: Int, goal: Int, streak: Int): List<Float> |
| HabitsZone.kt | `generatePeriodHistory` | private fun generatePeriodHistory( |
| HabitsZone.kt | `generateStreakHistory` | private fun generateStreakHistory(currentStreak: Int): List<Float> |
| HabitsZone.kt | `generateSuccessRateHistory` | private fun generateSuccessRateHistory(currentRate: Int): List<Float> |
| RecurrenceZone.kt | `CustomRecurrenceBuilder` | private fun CustomRecurrenceBuilder( |
| RecurrenceZone.kt | `PresetSelector` | private fun PresetSelector( |
| RecurrenceZone.kt | `RecurrenceExceptionsDisplay` | private fun RecurrenceExceptionsDisplay(exceptions: List<String>) |
| RecurrenceZone.kt | `RecurrenceZone` | fun RecurrenceZone( |
| RecurrenceZone.kt | `determinePreset` | private fun determinePreset(rule: RecurrenceRule?): RecurrencePreset |
| RecurrenceZone.kt | `formatExceptionDate` | private fun formatExceptionDate(dateStr: String): String |
| RecurrenceZone.kt | `formatUntilDate` | private fun formatUntilDate(dateStr: String): String |
| RecurrenceZone.kt | `parseExceptions` | private fun parseExceptions(exceptionsJson: String?, gson: Gson): List<String> |
| RecurrenceZone.kt | `parseRecurrenceRule` | private fun parseRecurrenceRule(ruleJson: String?, gson: Gson): RecurrenceRule? |
| TagsPickerSheet.kt | `TagTreeRow` | private fun TagTreeRow( |
| TagsPickerSheet.kt | `TagsPickerSheet` | fun TagsPickerSheet( |
| TagsPickerSheet.kt | `androidx` | private fun androidx.compose.foundation.lazy.LazyListScope.renderTagTree( |
| TagsPickerSheet.kt | `collectAllPaths` | private fun collectAllPaths(nodes: List<TagNode>): List<String> |
| TagsPickerSheet.kt | `collectFavorites` | private fun collectFavorites(nodes: List<TagNode>): List<TagNode> |
| TagsPickerSheet.kt | `contrastTextColor` | private fun contrastTextColor(background: Color): Color |
| TagsPickerSheet.kt | `filterTagTree` | private fun filterTagTree(nodes: List<TagNode>, query: String): List<TagNode> |
| TagsPickerSheet.kt | `parseTagColor` | private fun parseTagColor(hex: String): Color |
| TagsPickerSheet.kt | `walk` | fun walk(list: List<TagNode>) |

## ui/screens/email/

| File | Function | Signature |
|------|----------|----------|
| AccountFilterPills.kt | `AccountFilterPills` | fun AccountFilterPills( |
| AccountFilterPills.kt | `AccountPill` | private fun AccountPill( |
| AccountFilterPills.kt | `ErrorDetailDialog` | private fun ErrorDetailDialog( |
| AccountsModal.kt | `AccountCard` | private fun AccountCard( |
| AccountsModal.kt | `AccountEditView` | private fun AccountEditView( |
| AccountsModal.kt | `AccountListView` | private fun AccountListView( |
| AccountsModal.kt | `AccountsModal` | fun AccountsModal( |
| AccountsModal.kt | `ConnectionStatusRow` | private fun ConnectionStatusRow( |
| AccountsModal.kt | `SecuritySelector` | private fun SecuritySelector( |
| AccountsModal.kt | `TestConnectionSection` | private fun TestConnectionSection( |
| AccountsModal.kt | `buildServerSummary` | private fun buildServerSummary(account: EmailAccountConfig): String |
| AttachmentBar.kt | `AttachmentBar` | fun AttachmentBar( |
| AttachmentBar.kt | `AttachmentChip` | private fun AttachmentChip( |
| AttachmentBar.kt | `AttachmentPreviewDialog` | private fun AttachmentPreviewDialog( |
| AttachmentBar.kt | `buildAttachmentUrl` | private fun buildAttachmentUrl(url: String?, serverUrl: String): String? |
| AttachmentBar.kt | `fileTypeIcon` | private fun fileTypeIcon(contentType: String?, filename: String): ImageVector |
| AttachmentBar.kt | `formatFileSize` | private fun formatFileSize(bytes: Long): String |
| AttachmentBar.kt | `parseAttachmentBarItems` | private fun parseAttachmentBarItems(attachmentsJson: String?): List<AttachmentBarItem> |
| BulkActionsBar.kt | `BulkActionsBar` | fun BulkActionsBar( |
| BundleContextMenu.kt | `BundleContextMenu` | fun BundleContextMenu( |
| BundleModals.kt | `ColorSwatchPicker` | private fun ColorSwatchPicker( |
| BundleModals.kt | `CreateBundleModal` | fun CreateBundleModal( |
| BundleModals.kt | `EditBundleModal` | fun EditBundleModal( |
| BundleModals.kt | `parseColorHex` | private fun parseColorHex(hex: String): Color |
| BundleToolbar.kt | `BundleTabChip` | private fun BundleTabChip( |
| BundleToolbar.kt | `BundleTabsRow` | private fun BundleTabsRow( |
| BundleToolbar.kt | `BundleToolbar` | fun BundleToolbar( |
| BundleToolbar.kt | `DropIndicator` | private fun DropIndicator() |
| BundleToolbar.kt | `PriorityArrow` | private fun PriorityArrow() |
| BundleToolbar.kt | `calculateDropTarget` | private fun calculateDropTarget( |
| BundleToolbar.kt | `parseColor` | private fun parseColor(colorStr: String): Color? |
| BundleViewModel.kt | `clearError` | fun clearError() |
| BundleViewModel.kt | `createBundle` | fun createBundle( |
| BundleViewModel.kt | `deleteBundle` | fun deleteBundle(id: String, onResult: (Result<Unit>) -> Unit |
| BundleViewModel.kt | `disableBundle` | fun disableBundle(id: String, onResult: (Result<Unit>) -> Unit |
| BundleViewModel.kt | `dismissContextMenu` | fun dismissContextMenu() |
| BundleViewModel.kt | `fetchBundles` | fun fetchBundles() |
| BundleViewModel.kt | `formatBundleCount` | fun formatBundleCount(unreadCount: Int, totalCount: Int): String |
| BundleViewModel.kt | `reorderBundles` | fun reorderBundles(orderedIds: List<String>, onResult: (Result<Unit>) -> Unit |
| BundleViewModel.kt | `selectBundle` | fun selectBundle(bundleId: String?) |
| BundleViewModel.kt | `showContextMenu` | fun showContextMenu(bundleId: String) |
| BundleViewModel.kt | `startReordering` | fun startReordering() |
| BundleViewModel.kt | `stopReordering` | fun stopReordering() |
| BundleViewModel.kt | `updateBundle` | fun updateBundle( |
| EmailCardEnhanced.kt | `AttachmentThumbnailsRow` | private fun AttachmentThumbnailsRow( |
| EmailCardEnhanced.kt | `EmailCardEnhanced` | fun EmailCardEnhanced( |
| EmailCardEnhanced.kt | `EmailTagChipsRow` | private fun EmailTagChipsRow( |
| EmailCardEnhanced.kt | `StatusBadge` | private fun StatusBadge( |
| EmailCardEnhanced.kt | `ThreadCountBadge` | private fun ThreadCountBadge( |
| EmailCardEnhanced.kt | `avatarColorForName` | private fun avatarColorForName(name: String): Color |
| EmailCardEnhanced.kt | `extractInitial` | private fun extractInitial(displayName: String): String |
| EmailCardEnhanced.kt | `extractSenderDisplayName` | private fun extractSenderDisplayName(emailFrom: String?): String |
| EmailCardEnhanced.kt | `parseAttachments` | private fun parseAttachments(attachmentsJson: String?): List<AttachmentInfo> |
| EmailCardEnhanced.kt | `tagColorFromHash` | private fun tagColorFromHash(tagName: String): Color |
| EmailComposeViewModel.kt | `addChipToField` | private fun addChipToField(chip: RecipientChip, field: RecipientField) |
| EmailComposeViewModel.kt | `addRecipient` | fun addRecipient(contact: ContactEntity, field: RecipientField) |
| EmailComposeViewModel.kt | `applyFormatting` | fun applyFormatting(operation: FormattingOperation, selection: TextSelection) |
| EmailComposeViewModel.kt | `applyLink` | fun applyLink(selection: TextSelection, url: String) |
| EmailComposeViewModel.kt | `canSendEmail` | fun canSendEmail( |
| EmailComposeViewModel.kt | `cancelSchedule` | fun cancelSchedule() |
| EmailComposeViewModel.kt | `cancelSend` | fun cancelSend() |
| EmailComposeViewModel.kt | `checkExistingDraft` | fun checkExistingDraft( |
| EmailComposeViewModel.kt | `chipify` | fun chipify(rawText: String, field: RecipientField) |
| EmailComposeViewModel.kt | `clearDecryptedState` | fun clearDecryptedState() |
| EmailComposeViewModel.kt | `clearError` | fun clearError() |
| EmailComposeViewModel.kt | `clearStatusMessage` | fun clearStatusMessage() |
| EmailComposeViewModel.kt | `contactToChip` | private fun contactToChip(contact: ContactEntity): RecipientChip |
| EmailComposeViewModel.kt | `decryptBody` | fun decryptBody(password: String) |
| EmailComposeViewModel.kt | `extractEmailsFromContact` | private fun extractEmailsFromContact(contact: ContactEntity): List<String> |
| EmailComposeViewModel.kt | `findContactByEmail` | private fun findContactByEmail(email: String): ContactEntity? |
| EmailComposeViewModel.kt | `getExistingChipEmails` | private fun getExistingChipEmails(): List<String> |
| EmailComposeViewModel.kt | `initializeForChit` | fun initializeForChit(chitId: String) |
| EmailComposeViewModel.kt | `initiateSend` | fun initiateSend(onNavigateToList: () -> Unit) |
| EmailComposeViewModel.kt | `onCleared` | override fun onCleared() |
| EmailComposeViewModel.kt | `parseRecipientsToChips` | private fun parseRecipientsToChips(recipientString: String?): List<RecipientChip> |
| EmailComposeViewModel.kt | `removeRecipient` | fun removeRecipient(email: String, field: RecipientField) |
| EmailComposeViewModel.kt | `saveDraft` | fun saveDraft(onSaved: () -> Unit |
| EmailComposeViewModel.kt | `scheduleSend` | fun scheduleSend(sendAt: String, onNavigateToScheduled: () -> Unit) |
| EmailComposeViewModel.kt | `sendAndArchive` | fun sendAndArchive(onNavigateToList: () -> Unit) |
| EmailComposeViewModel.kt | `startSendCountdown` | private fun startSendCountdown(chitId: String, archiveOriginalMessageId: String?) |
| EmailComposeViewModel.kt | `togglePgp` | fun togglePgp() |
| EmailComposeViewModel.kt | `toggleReadReceipt` | fun toggleReadReceipt() |
| EmailComposeViewModel.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline(chitId: String) |
| EmailComposeViewModel.kt | `updateAutocompleteQuery` | fun updateAutocompleteQuery(query: String, field: RecipientField) |
| EmailComposeViewModel.kt | `updateBody` | fun updateBody(newBody: String) |
| EmailComposeViewModel.kt | `updateCanSend` | private fun updateCanSend() |
| EmailComposeViewModel.kt | `updateSubject` | fun updateSubject(newSubject: String) |
| EmailComposeViewModel.kt | `updateTitle` | fun updateTitle(newTitle: String) |
| EmailComposeViewModel.kt | `validatePgpState` | private fun validatePgpState() |
| EmailComposeViewModel.kt | `validateRecipientKeys` | fun validateRecipientKeys(): Boolean |
| EmailComposeZone.kt | `EmailComposeZone` | fun EmailComposeZone( |
| EmailComposeZone.kt | `MarkdownPreviewBox` | private fun MarkdownPreviewBox( |
| EmailComposeZone.kt | `PgpDecryptionBanner` | private fun PgpDecryptionBanner( |
| EmailComposeZone.kt | `PgpPasswordDialog` | private fun PgpPasswordDialog( |
| EmailComposeZone.kt | `PgpToggleButton` | private fun PgpToggleButton( |
| EmailComposeZone.kt | `ScheduledSendIndicator` | private fun ScheduledSendIndicator( |
| EmailContextMenu.kt | `EmailContextMenu` | fun EmailContextMenu( |
| EmailScreen.kt | `CheckMailAndToggleRow` | private fun CheckMailAndToggleRow( |
| EmailScreen.kt | `DateGroupHeader` | private fun DateGroupHeader(dateGroup: DateGroup) |
| EmailScreen.kt | `EmailListWithDateGroups` | private fun EmailListWithDateGroups( |
| EmailScreen.kt | `EmailScreen` | fun EmailScreen( |
| EmailScreen.kt | `EmptyStateWithContext` | private fun EmptyStateWithContext( |
| EmailScreen.kt | `LoadMoreButton` | private fun LoadMoreButton( |
| EmailSettingsScreen.kt | `AccountsSection` | private fun AccountsSection( |
| EmailSettingsScreen.kt | `AutoBundleToggleRow` | private fun AutoBundleToggleRow( |
| EmailSettingsScreen.kt | `BackfillSection` | private fun BackfillSection( |
| EmailSettingsScreen.kt | `BundleSection` | private fun BundleSection( |
| EmailSettingsScreen.kt | `CheckboxRow` | private fun CheckboxRow( |
| EmailSettingsScreen.kt | `DisplaySection` | private fun DisplaySection( |
| EmailSettingsScreen.kt | `DropdownSelector` | private fun DropdownSelector( |
| EmailSettingsScreen.kt | `EmailSettingsScreen` | fun EmailSettingsScreen( |
| EmailSettingsScreen.kt | `PrivacySection` | private fun PrivacySection( |
| EmailSettingsScreen.kt | `SectionDivider` | private fun SectionDivider() |
| EmailSettingsScreen.kt | `SectionHeader` | private fun SectionHeader(title: String) |
| EmailSettingsScreen.kt | `SignatureSection` | private fun SignatureSection( |
| EmailSettingsViewModel.kt | `addAccount` | fun addAccount(account: EmailAccountConfig) |
| EmailSettingsViewModel.kt | `backfillEstimate` | fun backfillEstimate() |
| EmailSettingsViewModel.kt | `clearBackfillState` | fun clearBackfillState() |
| EmailSettingsViewModel.kt | `clearError` | fun clearError() |
| EmailSettingsViewModel.kt | `clearTestConnectionState` | fun clearTestConnectionState() |
| EmailSettingsViewModel.kt | `deleteAccount` | fun deleteAccount(index: Int) |
| EmailSettingsViewModel.kt | `editAccount` | fun editAccount(index: Int, account: EmailAccountConfig) |
| EmailSettingsViewModel.kt | `loadSettings` | fun loadSettings() |
| EmailSettingsViewModel.kt | `observeBundles` | private fun observeBundles() |
| EmailSettingsViewModel.kt | `parseAccountsJson` | fun parseAccountsJson(json: String?): List<EmailAccountConfig> |
| EmailSettingsViewModel.kt | `saveSettings` | fun saveSettings() |
| EmailSettingsViewModel.kt | `saveSignature` | fun saveSignature() |
| EmailSettingsViewModel.kt | `serializeAccountsJson` | fun serializeAccountsJson(accounts: List<EmailAccountConfig>): String |
| EmailSettingsViewModel.kt | `testConnection` | fun testConnection(account: EmailAccountConfig) |
| EmailSettingsViewModel.kt | `toggleAutoBundle` | fun toggleAutoBundle(bundleId: String, enable: Boolean) |
| EmailSettingsViewModel.kt | `triggerBackfill` | fun triggerBackfill() |
| EmailSettingsViewModel.kt | `updateBundleSetting` | fun updateBundleSetting(update: (EmailBundleSettings) -> EmailBundleSettings) |
| EmailSettingsViewModel.kt | `updateCheckInterval` | fun updateCheckInterval(interval: String) |
| EmailSettingsViewModel.kt | `updateDisplaySetting` | fun updateDisplaySetting(update: (EmailDisplaySettings) -> EmailDisplaySettings) |
| EmailSettingsViewModel.kt | `updateMaxPull` | fun updateMaxPull(maxPull: String) |
| EmailSettingsViewModel.kt | `updatePrivacySetting` | fun updatePrivacySetting(update: (EmailPrivacySettings) -> EmailPrivacySettings) |
| EmailSettingsViewModel.kt | `updateSignature` | fun updateSignature(signature: String) |
| EmailThreadView.kt | `EmailThreadView` | fun EmailThreadView( |
| EmailThreadView.kt | `NestedChitCard` | private fun NestedChitCard( |
| EmailThreadView.kt | `formatChitDate` | private fun formatChitDate(dueDatetime: String?, startDatetime: String?): String |
| EmailThreadView.kt | `stripNotePreview` | private fun stripNotePreview(note: String?): String |
| EmailThreadViewInEditor.kt | `CollapsedThreadView` | private fun CollapsedThreadView( |
| EmailThreadViewInEditor.kt | `EmailThreadViewInEditor` | fun EmailThreadViewInEditor( |
| EmailThreadViewInEditor.kt | `SimpleThreadList` | private fun SimpleThreadList( |
| EmailThreadViewInEditor.kt | `ThreadMessageRow` | private fun ThreadMessageRow( |
| EmailThreadViewInEditor.kt | `ThreadNestedChitRow` | private fun ThreadNestedChitRow( |
| EmailThreadViewInEditor.kt | `buildThreadDisplayItems` | private fun buildThreadDisplayItems( |
| EmailThreadViewInEditor.kt | `extractSenderName` | private fun extractSenderName(from: String?): String |
| EmailThreadViewInEditor.kt | `truncateBodyPreview` | private fun truncateBodyPreview(body: String?, maxChars: Int = 100): String |
| EmailViewModel.kt | `archive` | fun archive(chitId: String) |
| EmailViewModel.kt | `archiveWithUndo` | fun archiveWithUndo(chitId: String, subject: String) |
| EmailViewModel.kt | `bulkArchive` | fun bulkArchive(onResult: (Int, Int) -> Unit |
| EmailViewModel.kt | `bulkDelete` | fun bulkDelete(onResult: (Int, Int) -> Unit |
| EmailViewModel.kt | `bulkToggleRead` | fun bulkToggleRead() |
| EmailViewModel.kt | `cancelUndo` | fun cancelUndo() |
| EmailViewModel.kt | `createForward` | fun createForward(originalChitId: String, onCreated: (String) -> Unit) |
| EmailViewModel.kt | `createReply` | fun createReply(originalChitId: String, onCreated: (String) -> Unit) |
| EmailViewModel.kt | `deleteWithUndo` | fun deleteWithUndo(chitId: String, subject: String) |
| EmailViewModel.kt | `enrichThread` | private fun enrichThread(thread: EmailThread, use24Hour: Boolean): EmailThread |
| EmailViewModel.kt | `enterMultiSelect` | fun enterMultiSelect(chitId: String) |
| EmailViewModel.kt | `executeUndoAction` | private fun executeUndoAction(action: UndoAction) |
| EmailViewModel.kt | `exitMultiSelect` | fun exitMultiSelect() |
| EmailViewModel.kt | `filterByFolder` | private fun filterByFolder(chits: List<ChitEntity>, folder: String): List<ChitEntity> |
| EmailViewModel.kt | `findNestedChits` | private fun findNestedChits(thread: EmailThread): List<ChitEntity> |
| EmailViewModel.kt | `groupIntoThreads` | private fun groupIntoThreads(chits: List<ChitEntity>): List<EmailThread> |
| EmailViewModel.kt | `hasReplyIndicator` | private fun hasReplyIndicator(thread: EmailThread): Boolean |
| EmailViewModel.kt | `loadMore` | fun loadMore() |
| EmailViewModel.kt | `markAsRead` | fun markAsRead(chitId: String) |
| EmailViewModel.kt | `markAsUnread` | fun markAsUnread(chitId: String) |
| EmailViewModel.kt | `moveToTrash` | fun moveToTrash(chitId: String) |
| EmailViewModel.kt | `normalizeSubject` | private fun normalizeSubject(subject: String?): String |
| EmailViewModel.kt | `onCleared` | override fun onCleared() |
| EmailViewModel.kt | `parseAccountsFromSettings` | private fun parseAccountsFromSettings(accountsJson: String?): List<EmailAccountInfo> |
| EmailViewModel.kt | `recomputeState` | private fun recomputeState() |
| EmailViewModel.kt | `selectAll` | fun selectAll() |
| EmailViewModel.kt | `setAccountFilter` | fun setAccountFilter(accounts: List<String>) |
| EmailViewModel.kt | `setBundle` | fun setBundle(bundle: String?) |
| EmailViewModel.kt | `setFolder` | fun setFolder(folder: String) |
| EmailViewModel.kt | `setupAutoCheckTimer` | private fun setupAutoCheckTimer(interval: String) |
| EmailViewModel.kt | `sortThreads` | private fun sortThreads(threads: List<EmailThread>, unreadAtTop: Boolean): List<EmailThread> |
| EmailViewModel.kt | `startUndoCountdown` | private fun startUndoCountdown(action: UndoAction) |
| EmailViewModel.kt | `toggleAccountFilter` | fun toggleAccountFilter(accountId: String) |
| EmailViewModel.kt | `togglePin` | fun togglePin(chitId: String) |
| EmailViewModel.kt | `toggleReadState` | fun toggleReadState(chitId: String) |
| EmailViewModel.kt | `toggleSelection` | fun toggleSelection(chitId: String) |
| EmailViewModel.kt | `toggleUnreadAtTop` | fun toggleUnreadAtTop() |
| EmailViewModel.kt | `triggerPushIfOnline` | private fun triggerPushIfOnline(chitId: String) |
| EmailViewModel.kt | `triggerSync` | fun triggerSync() |
| FormattingToolbar.kt | `FormattingToolbar` | fun FormattingToolbar( |
| HtmlEmailRenderer.kt | `ExternalContentBanner` | private fun ExternalContentBanner( |
| HtmlEmailRenderer.kt | `HtmlEmailRenderer` | fun HtmlEmailRenderer( |
| HtmlEmailRenderer.kt | `HtmlTextToggle` | private fun HtmlTextToggle( |
| HtmlEmailRenderer.kt | `HtmlWebView` | private fun HtmlWebView( |
| HtmlEmailRenderer.kt | `PlainTextView` | private fun PlainTextView( |
| HtmlEmailRenderer.kt | `blockExternalImages` | internal fun blockExternalImages(html: String): String |
| HtmlEmailRenderer.kt | `htmlToPlainText` | private fun htmlToPlainText(html: String): String |
| HtmlEmailRenderer.kt | `onPageFinished` | override fun onPageFinished(view: WebView?, url: String?) |
| HtmlEmailRenderer.kt | `sanitizeHtml` | internal fun sanitizeHtml(html: String): String |
| HtmlEmailRenderer.kt | `shouldOverrideUrlLoading` | override fun shouldOverrideUrlLoading( |
| RecipientChipField.kt | `AutocompleteResultItem` | private fun AutocompleteResultItem( |
| RecipientChipField.kt | `ChipAvatar` | private fun ChipAvatar( |
| RecipientChipField.kt | `RecipientChipField` | fun RecipientChipField( |
| RecipientChipField.kt | `RecipientChipItem` | private fun RecipientChipItem( |
| RecipientChipField.kt | `extractInitial` | private fun extractInitial(text: String): String |
| RecipientChipField.kt | `extractPrimaryEmail` | private fun extractPrimaryEmail(contact: ContactEntity): String? |
| RecipientChipField.kt | `parseChipColor` | private fun parseChipColor(hex: String): Color? |
| SendLaterModal.kt | `SendLaterModal` | fun SendLaterModal( |
| SendLaterModal.kt | `isSelectableDate` | override fun isSelectableDate(utcTimeMillis: Long): Boolean |
| SendLaterModal.kt | `isSelectableYear` | override fun isSelectableYear(year: Int): Boolean |
| SignatureEditorModal.kt | `SignatureEditorModal` | fun SignatureEditorModal( |
| SignatureEditorModal.kt | `SignatureMarkdownPreview` | private fun SignatureMarkdownPreview(markdownText: String) |
| SignatureEditorModal.kt | `applyMarkdownLink` | private fun applyMarkdownLink(value: TextFieldValue): TextFieldValue |
| SignatureEditorModal.kt | `applyMarkdownWrap` | private fun applyMarkdownWrap(value: TextFieldValue, marker: String): TextFieldValue |
| SignatureEditorModal.kt | `renderInlineMarkdown` | private fun renderInlineMarkdown(text: String): String |
| SmartLinkBadges.kt | `SmartLinkBadges` | fun SmartLinkBadges( |
| SmartLinkBadges.kt | `categoryIcon` | private fun categoryIcon(category: String): ImageVector |
| TagPickerModal.kt | `TagPickerModal` | fun TagPickerModal( |
| TagPickerModal.kt | `TagPickerRow` | private fun TagPickerRow( |
| TagPickerModal.kt | `androidx` | private fun androidx.compose.foundation.lazy.LazyListScope.renderTagPickerTree( |
| TagPickerModal.kt | `collectAllParentPaths` | private fun collectAllParentPaths(nodes: List<TagNode>): List<String> |
| TagPickerModal.kt | `filterTagTree` | private fun filterTagTree(nodes: List<TagNode>, query: String): List<TagNode> |
| TagPickerModal.kt | `parseHexColor` | private fun parseHexColor(hex: String): Color |
| TagPickerModal.kt | `walk` | fun walk(list: List<TagNode>) |

## ui/screens/help/

| File | Function | Signature |
|------|----------|----------|
| HelpScreen.kt | `HelpErrorState` | private fun HelpErrorState() |
| HelpScreen.kt | `HelpLoadingState` | private fun HelpLoadingState() |
| HelpScreen.kt | `HelpScreen` | fun HelpScreen( |
| HelpScreen.kt | `HelpTopicCard` | private fun HelpTopicCard( |
| HelpScreen.kt | `HelpTopicList` | private fun HelpTopicList( |
| HelpViewModel.kt | `extractTitle` | private fun extractTitle(content: String, slug: String): String |
| HelpViewModel.kt | `formatSlugAsTitle` | private fun formatSlugAsTitle(slug: String): String |
| HelpViewModel.kt | `goBack` | fun goBack() |
| HelpViewModel.kt | `loadTopics` | private fun loadTopics() |
| HelpViewModel.kt | `selectTopic` | fun selectTopic(slug: String) |

## ui/screens/indicators/

| File | Function | Signature |
|------|----------|----------|
| IndicatorsScreen.kt | `CanvasLineChart` | private fun CanvasLineChart( |
| IndicatorsScreen.kt | `EmptyIndicatorsState` | private fun EmptyIndicatorsState() |
| IndicatorsScreen.kt | `IndicatorChartCard` | private fun IndicatorChartCard(chart: IndicatorChart) |
| IndicatorsScreen.kt | `IndicatorsCalendarView` | private fun IndicatorsCalendarView(healthEntries: List<HealthEntry>) |
| IndicatorsScreen.kt | `IndicatorsLogView` | private fun IndicatorsLogView(healthEntries: List<HealthEntry>) |
| IndicatorsScreen.kt | `IndicatorsModeToggle` | private fun IndicatorsModeToggle( |
| IndicatorsScreen.kt | `IndicatorsScreen` | fun IndicatorsScreen( |
| IndicatorsScreen.kt | `indicatorTypeColor` | private fun indicatorTypeColor(type: String): Color |
| IndicatorsViewModel.kt | `setTimeRange` | fun setTimeRange(range: TimeRange) |

## ui/screens/kiosk/

| File | Function | Signature |
|------|----------|----------|
| KioskScreen.kt | `DayGroup` | private fun DayGroup( |
| KioskScreen.kt | `EventRow` | private fun EventRow(chit: KioskChit, onClick: () -> Unit) |
| KioskScreen.kt | `KioskScreen` | fun KioskScreen( |
| KioskScreen.kt | `PeriodBar` | private fun PeriodBar( |
| KioskScreen.kt | `TaskRow` | private fun TaskRow(chit: KioskChit, onClick: () -> Unit) |
| KioskScreen.kt | `chitDateKey` | private fun chitDateKey(chit: KioskChit): String |
| KioskScreen.kt | `chitDateKeyFromStr` | private fun chitDateKeyFromStr(dateStr: String): String |
| KioskScreen.kt | `chitDateStr` | private fun chitDateStr(chit: KioskChit): String |
| KioskScreen.kt | `chitInRange` | private fun chitInRange(chit: KioskChit, start: Calendar, end: Calendar): Boolean |
| KioskScreen.kt | `dateKey` | private fun dateKey(cal: Calendar): String |
| KioskScreen.kt | `fetchData` | private fun fetchData() |
| KioskScreen.kt | `formatDayLabel` | private fun formatDayLabel(dayKey: String): String |
| KioskScreen.kt | `formatTime` | private fun formatTime(dateStr: String?): String? |
| KioskScreen.kt | `getPeriodLabel` | private fun getPeriodLabel(period: KioskPeriod, anchor: Calendar): String |
| KioskScreen.kt | `getPeriodRange` | private fun getPeriodRange(period: KioskPeriod, anchor: Calendar): Pair<Calendar, Calendar> |
| KioskScreen.kt | `hasDate` | private fun hasDate(chit: KioskChit): Boolean |
| KioskScreen.kt | `isActiveTask` | private fun isActiveTask(chit: KioskChit): Boolean |
| KioskScreen.kt | `isLightColor` | private fun isLightColor(color: Color): Boolean |
| KioskScreen.kt | `parseChitColor` | private fun parseChitColor(color: String?): Color |
| KioskScreen.kt | `refresh` | fun refresh() |
| KioskScreen.kt | `startLoading` | fun startLoading(selectedTags: List<String>) |
| KioskScreen.kt | `statusIcon` | private fun statusIcon(status: String?): String |
| KioskScreen.kt | `taskOrder` | private fun taskOrder(chit: KioskChit): Int |

## ui/screens/login/

| File | Function | Signature |
|------|----------|----------|
| LoginScreen.kt | `LoginScreen` | fun LoginScreen( |
| LoginViewModel.kt | `checkClientTrusted` | override fun checkClientTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| LoginViewModel.kt | `checkServerTrusted` | override fun checkServerTrusted(chain: Array<out java.security.cert.X509Certificate>?, authType: String?) |
| LoginViewModel.kt | `fetchLoginMessage` | private fun fetchLoginMessage() |
| LoginViewModel.kt | `getAcceptedIssuers` | override fun getAcceptedIssuers(): Array<java.security.cert.X509Certificate> = arrayOf() |
| LoginViewModel.kt | `isValidServerUrl` | private fun isValidServerUrl(url: String): Boolean |
| LoginViewModel.kt | `login` | fun login() |
| LoginViewModel.kt | `onPasswordChanged` | fun onPasswordChanged(password: String) |
| LoginViewModel.kt | `onServerUrlChanged` | fun onServerUrlChanged(url: String) |
| LoginViewModel.kt | `onUsernameChanged` | fun onUsernameChanged(username: String) |

## ui/screens/map/

| File | Function | Signature |
|------|----------|----------|
| MapScreen.kt | `EmptyMapState` | private fun EmptyMapState(mapMode: MapMode = MapMode.CHITS) |
| MapScreen.kt | `MapFilters` | private fun MapFilters( |
| MapScreen.kt | `MapModeToggle` | private fun MapModeToggle( |
| MapScreen.kt | `MapScreen` | fun MapScreen( |
| MapScreen.kt | `MapSearchBar` | private fun MapSearchBar( |
| MapViewModel.kt | `applyChitFilters` | private fun applyChitFilters(markers: List<ChitMarkerWithEntity>): List<ChitMarker> |
| MapViewModel.kt | `chitInDateRange` | private fun chitInDateRange(chit: ChitEntity, start: LocalDate, end: LocalDate): Boolean |
| MapViewModel.kt | `clearFilters` | fun clearFilters() |
| MapViewModel.kt | `clearFlyTo` | fun clearFlyTo() |
| MapViewModel.kt | `clearGoToError` | fun clearGoToError() |
| MapViewModel.kt | `computeBounds` | fun computeBounds(markers: List<ChitMarker>): BoundingBox? |
| MapViewModel.kt | `createContactMarker` | private fun createContactMarker(contact: ContactEntity, geoPoint: GeoPoint): ChitMarker |
| MapViewModel.kt | `extractFirstAddress` | private fun extractFirstAddress(addressesJson: String?): String? |
| MapViewModel.kt | `goToAddress` | fun goToAddress(address: String) |
| MapViewModel.kt | `isChitOverdue` | private fun isChitOverdue(chit: ChitEntity): Boolean |
| MapViewModel.kt | `loadChitMarkers` | private fun loadChitMarkers() |
| MapViewModel.kt | `loadContactMarkers` | private fun loadContactMarkers() |
| MapViewModel.kt | `loadSettings` | private fun loadSettings() |
| MapViewModel.kt | `markerColor` | fun markerColor(colorStr: String?): Int |
| MapViewModel.kt | `nextPeriod` | fun nextPeriod() |
| MapViewModel.kt | `parseLatLng` | private fun parseLatLng(location: String): Pair<Double, Double>? |
| MapViewModel.kt | `parseMarkerWithEntity` | private fun parseMarkerWithEntity(chit: ChitEntity): ChitMarkerWithEntity? |
| MapViewModel.kt | `persistMode` | private fun persistMode(mode: MapMode) |
| MapViewModel.kt | `previousPeriod` | fun previousPeriod() |
| MapViewModel.kt | `resolveChitColor` | private fun resolveChitColor(chit: ChitEntity): Int |
| MapViewModel.kt | `restoreMode` | private fun restoreMode(): MapMode |
| MapViewModel.kt | `setAllPeople` | fun setAllPeople(enabled: Boolean) |
| MapViewModel.kt | `setMapMode` | fun setMapMode(mode: MapMode) |
| MapViewModel.kt | `setPeriod` | fun setPeriod(period: MapPeriod) |
| MapViewModel.kt | `setSearchQuery` | fun setSearchQuery(query: String) |
| MapViewModel.kt | `togglePriorityFilter` | fun togglePriorityFilter(priority: String) |
| MapViewModel.kt | `toggleStatusFilter` | fun toggleStatusFilter(status: String) |
| MapViewModel.kt | `updatePeriodLabel` | private fun updatePeriodLabel() |
| MapViewModel.kt | `updateVisibleMarkers` | private fun updateVisibleMarkers() |

## ui/screens/notebook/

| File | Function | Signature |
|------|----------|----------|
| NotebookScreen.kt | `NotebookCard` | private fun NotebookCard( |
| NotebookScreen.kt | `NotebookScreen` | fun NotebookScreen( |
| NotebookScreen.kt | `buildNotebookIndicators` | private fun buildNotebookIndicators(chit: ChitEntity, currentUserId: String): String |
| NotebookViewModel.kt | `finalizeDelete` | fun finalizeDelete(chitId: String? = null) |
| NotebookViewModel.kt | `softDelete` | fun softDelete(chitId: String) |
| NotebookViewModel.kt | `toggleChecklistItem` | fun toggleChecklistItem(chitId: String, itemIndex: Int) |
| NotebookViewModel.kt | `undoDelete` | fun undoDelete() |

## ui/screens/notes/

| File | Function | Signature |
|------|----------|----------|
| NotesScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState(onClearFilters: () -> Unit) |
| NotesScreen.kt | `NoteCard` | private fun NoteCard( |
| NotesScreen.kt | `NotesEmptyState` | private fun NotesEmptyState() |
| NotesScreen.kt | `NotesList` | private fun NotesList( |
| NotesScreen.kt | `NotesLoadingSkeleton` | private fun NotesLoadingSkeleton() |
| NotesScreen.kt | `NotesScreen` | fun NotesScreen( |
| NotesScreen.kt | `buildNoteIndicators` | private fun buildNoteIndicators(note: ChitEntity, currentUserId: String): String |
| NotesViewModel.kt | `finalizeDelete` | fun finalizeDelete(chitId: String? = null) |
| NotesViewModel.kt | `softDelete` | fun softDelete(chitId: String) |
| NotesViewModel.kt | `undoDelete` | fun undoDelete() |

## ui/screens/notifications/

| File | Function | Signature |
|------|----------|----------|
| NotificationsScreen.kt | `NotificationCard` | private fun NotificationCard( |
| NotificationsScreen.kt | `NotificationsScreen` | fun NotificationsScreen( |
| NotificationsViewModel.kt | `accept` | fun accept(id: String) |
| NotificationsViewModel.kt | `decline` | fun decline(id: String) |
| NotificationsViewModel.kt | `dismiss` | fun dismiss(id: String) |
| NotificationsViewModel.kt | `markRead` | fun markRead(id: String) |

## ui/screens/omni/

| File | Function | Signature |
|------|----------|----------|
| OmniLayoutDialog.kt | `OmniLayoutDialog` | fun OmniLayoutDialog( |
| OmniLayoutDialog.kt | `OmniLayoutSectionRow` | private fun OmniLayoutSectionRow( |
| OmniViewScreen.kt | `DueDateBadge` | private fun DueDateBadge(dueDatetime: String) |
| OmniViewScreen.kt | `OmniChitCard` | private fun OmniChitCard( |
| OmniViewScreen.kt | `OmniChronoCard` | private fun OmniChronoCard( |
| OmniViewScreen.kt | `OmniEmailCard` | private fun OmniEmailCard( |
| OmniViewScreen.kt | `OmniEmailPagination` | private fun OmniEmailPagination( |
| OmniViewScreen.kt | `OmniEmptySection` | private fun OmniEmptySection(sectionName: String = "") |
| OmniViewScreen.kt | `OmniHstBar` | private fun OmniHstBar( |
| OmniViewScreen.kt | `OmniPinnedAllCard` | private fun OmniPinnedAllCard( |
| OmniViewScreen.kt | `OmniReminderCard` | private fun OmniReminderCard( |
| OmniViewScreen.kt | `OmniSectionHeader` | private fun OmniSectionHeader(type: OmniSectionType) |
| OmniViewScreen.kt | `OmniSoonCard` | private fun OmniSoonCard( |
| OmniViewScreen.kt | `OmniViewScreen` | fun OmniViewScreen( |
| OmniViewScreen.kt | `OmniWeatherBar` | private fun OmniWeatherBar( |
| OmniViewScreen.kt | `OmniWeatherStrip` | private fun OmniWeatherStrip(data: OmniWeatherData) |
| OmniViewScreen.kt | `ReminderTimeUntilBadge` | private fun ReminderTimeUntilBadge(targetDatetime: String) |
| OmniViewScreen.kt | `TimeUntilBadge` | private fun TimeUntilBadge(startDatetime: String) |
| OmniViewScreen.kt | `computeDueDateText` | private fun computeDueDateText(dueDatetime: String): String |
| OmniViewScreen.kt | `computeReminderTimeUntil` | private fun computeReminderTimeUntil(targetDatetime: String): Pair<String, Boolean> |
| OmniViewScreen.kt | `computeTimeUntil` | private fun computeTimeUntil(startDatetime: String): String |
| OmniViewScreen.kt | `currentDayFraction` | private fun currentDayFraction(): Float |
| OmniViewScreen.kt | `formatHstTimeText` | private fun formatHstTimeText(clockMode: String): String |
| OmniViewScreen.kt | `isSectionEmpty` | private fun isSectionEmpty( |
| OmniViewScreen.kt | `resolveCardColor` | private fun resolveCardColor(chit: ChitEntity, colorMode: String, sectionId: String): Color |
| OmniViewScreen.kt | `resolveNormalizedColor` | private fun resolveNormalizedColor(chit: ChitEntity, sectionId: String): Color |
| OmniViewScreen.kt | `sectionData` | private fun sectionData( |
| OmniViewScreen.kt | `sectionIcon` | private fun sectionIcon(type: OmniSectionType): String = when (type) |
| OmniViewScreen.kt | `sectionLabel` | private fun sectionLabel(type: OmniSectionType): String = when (type) |
| OmniViewViewModel.kt | `buildHourlyForecast` | private fun buildHourlyForecast( |
| OmniViewViewModel.kt | `closeLayoutDialog` | fun closeLayoutDialog() |
| OmniViewViewModel.kt | `cycleHstMode` | fun cycleHstMode() |
| OmniViewViewModel.kt | `defaultSections` | fun defaultSections(): List<OmniSection> = listOf( |
| OmniViewViewModel.kt | `filterChronoAnchored` | private fun filterChronoAnchored( |
| OmniViewViewModel.kt | `filterEmailChits` | private fun filterEmailChits(chits: List<ChitEntity>): List<ChitEntity> |
| OmniViewViewModel.kt | `filterHstItems` | private fun filterHstItems( |
| OmniViewViewModel.kt | `filterOnDeck` | private fun filterOnDeck(chits: List<ChitEntity>): List<ChitEntity> |
| OmniViewViewModel.kt | `filterPinnedAll` | private fun filterPinnedAll(chits: List<ChitEntity>): List<ChitEntity> |
| OmniViewViewModel.kt | `filterPinnedChecklists` | private fun filterPinnedChecklists(chits: List<ChitEntity>): List<ChitEntity> |
| OmniViewViewModel.kt | `filterPinnedNotes` | private fun filterPinnedNotes(chits: List<ChitEntity>): List<ChitEntity> |
| OmniViewViewModel.kt | `filterReminders` | private fun filterReminders( |
| OmniViewViewModel.kt | `filterSoon` | private fun filterSoon( |
| OmniViewViewModel.kt | `formatHstTime` | private fun formatHstTime(ldt: LocalDateTime): String |
| OmniViewViewModel.kt | `getChitIcon` | private fun getChitIcon(chit: ChitEntity): String |
| OmniViewViewModel.kt | `getPinnedTypeIcon` | fun getPinnedTypeIcon(chit: ChitEntity): String |
| OmniViewViewModel.kt | `idToSectionType` | fun idToSectionType(id: String): OmniSectionType? = when (id) |
| OmniViewViewModel.kt | `isSnoozed` | private fun isSnoozed(chit: ChitEntity, now: Instant): Boolean |
| OmniViewViewModel.kt | `loadSectionConfig` | private fun loadSectionConfig() |
| OmniViewViewModel.kt | `loadWeatherData` | private fun loadWeatherData() |
| OmniViewViewModel.kt | `observeChits` | private fun observeChits() |
| OmniViewViewModel.kt | `openLayoutDialog` | fun openLayoutDialog() |
| OmniViewViewModel.kt | `parseToInstant` | private fun parseToInstant(dateStr: String): Instant? |
| OmniViewViewModel.kt | `parseToLocalDate` | private fun parseToLocalDate(dateStr: String, zone: ZoneId): LocalDate? |
| OmniViewViewModel.kt | `saveLayout` | fun saveLayout(updatedSections: List<OmniSection>) |
| OmniViewViewModel.kt | `sectionDisplayName` | fun sectionDisplayName(type: OmniSectionType): String = when (type) |
| OmniViewViewModel.kt | `sectionTypeToId` | fun sectionTypeToId(type: OmniSectionType): String = when (type) |
| OmniViewViewModel.kt | `toggleEmailExpanded` | fun toggleEmailExpanded() |
| OmniViewViewModel.kt | `weatherCodeToCondition` | fun weatherCodeToCondition(code: Int?): String |
| OmniViewViewModel.kt | `weatherCodeToIcon` | fun weatherCodeToIcon(code: Int?): String |

## ui/screens/placeholder/

| File | Function | Signature |
|------|----------|----------|
| PlaceholderScreen.kt | `PlaceholderScreen` | fun PlaceholderScreen(title: String) |

## ui/screens/projects/

| File | Function | Signature |
|------|----------|----------|
| KanbanColumn.kt | `String` | fun String?.toKanbanStatus(): KanbanStatus = KanbanStatus.fromString(this) |
| KanbanColumn.kt | `fromString` | fun fromString(status: String?): KanbanStatus |
| KanbanColumn.kt | `groupByKanbanStatus` | fun groupByKanbanStatus(chits: List<ChitEntity>): Map<KanbanStatus, List<ChitEntity>> |
| ProjectsScreen.kt | `EmptyProjectsState` | private fun EmptyProjectsState() |
| ProjectsScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState( |
| ProjectsScreen.kt | `KanbanBoard` | private fun KanbanBoard( |
| ProjectsScreen.kt | `KanbanColumnView` | private fun KanbanColumnView( |
| ProjectsScreen.kt | `ProjectCard` | private fun ProjectCard( |
| ProjectsScreen.kt | `ProjectsScreen` | fun ProjectsScreen( |
| ProjectsViewModel.kt | `createChildChit` | fun createChildChit(projectId: String, title: String) |
| ProjectsViewModel.kt | `moveToColumn` | fun moveToColumn(chitId: String, newStatus: KanbanStatus) |
| ProjectsViewModel.kt | `toggleExpanded` | fun toggleExpanded(projectId: String) |

## ui/screens/rules/

| File | Function | Signature |
|------|----------|----------|
| RuleEditorScreen.kt | `DropdownField` | private fun DropdownField( |
| RuleEditorScreen.kt | `RuleEditorScreen` | fun RuleEditorScreen( |
| RuleEditorViewModel.kt | `buildRequestBody` | private fun buildRequestBody(): String |
| RuleEditorViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| RuleEditorViewModel.kt | `deleteRule` | fun deleteRule(onSuccess: () -> Unit) |
| RuleEditorViewModel.kt | `loadRule` | fun loadRule(ruleId: String) |
| RuleEditorViewModel.kt | `populateForm` | private fun populateForm(rule: RuleItem) |
| RuleEditorViewModel.kt | `saveRule` | fun saveRule(onSuccess: () -> Unit) |
| RuleEditorViewModel.kt | `setActionConfigJson` | fun setActionConfigJson(value: String) |
| RuleEditorViewModel.kt | `setActionType` | fun setActionType(value: String) |
| RuleEditorViewModel.kt | `setCronExpression` | fun setCronExpression(value: String) |
| RuleEditorViewModel.kt | `setDescription` | fun setDescription(value: String) |
| RuleEditorViewModel.kt | `setEnabled` | fun setEnabled(value: Boolean) |
| RuleEditorViewModel.kt | `setEventType` | fun setEventType(value: String) |
| RuleEditorViewModel.kt | `setIsHabit` | fun setIsHabit(value: Boolean) |
| RuleEditorViewModel.kt | `setName` | fun setName(value: String) |
| RuleEditorViewModel.kt | `setTriggerType` | fun setTriggerType(value: String) |
| RulesManagerScreen.kt | `EmptyState` | private fun EmptyState() |
| RulesManagerScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| RulesManagerScreen.kt | `LoadingState` | private fun LoadingState() |
| RulesManagerScreen.kt | `RuleCard` | private fun RuleCard( |
| RulesManagerScreen.kt | `RulesManagerScreen` | fun RulesManagerScreen( |
| RulesManagerScreen.kt | `getTriggerSummary` | private fun getTriggerSummary(rule: RuleItem): String |
| RulesManagerViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| RulesManagerViewModel.kt | `loadRules` | fun loadRules() |
| RulesManagerViewModel.kt | `toggleRule` | fun toggleRule(ruleId: String) |

## ui/screens/search/

| File | Function | Signature |
|------|----------|----------|
| SearchScreen.kt | `PriorityBadge` | private fun PriorityBadge(priority: String) |
| SearchScreen.kt | `SearchResultCard` | private fun SearchResultCard( |
| SearchScreen.kt | `SearchScreen` | fun SearchScreen( |
| SearchScreen.kt | `buildHighlightedText` | private fun buildHighlightedText( |
| SearchScreen.kt | `statusColor` | private fun statusColor(status: String): Color |
| SearchViewModel.kt | `extractChecklistText` | private fun extractChecklistText(chit: ChitEntity): String? |
| SearchViewModel.kt | `extractTerms` | private fun extractTerms(node: SearchNode): List<String> |
| SearchViewModel.kt | `findHighlightRanges` | private fun findHighlightRanges(fieldValue: String, term: String): List<IntRange> |
| SearchViewModel.kt | `getFieldValue` | private fun getFieldValue(chit: ChitEntity, field: String): String? |
| SearchViewModel.kt | `getSearchableFields` | private fun getSearchableFields(chit: ChitEntity): List<Pair<String, String>> |
| SearchViewModel.kt | `mergeRanges` | private fun mergeRanges(ranges: List<IntRange>): List<IntRange> |
| SearchViewModel.kt | `onQueryChange` | fun onQueryChange(newQuery: String) |
| SearchViewModel.kt | `performSearch` | private fun performSearch(queryText: String, chits: List<ChitEntity>): List<SearchResult> |
| SearchViewModel.kt | `tokenizeForFieldExtraction` | private fun tokenizeForFieldExtraction(input: String): List<String> |

## ui/screens/settings/

| File | Function | Signature |
|------|----------|----------|
| AdminSettingsTab.kt | `AdminCollapsibleHeader` | private fun AdminCollapsibleHeader( |
| AdminSettingsTab.kt | `AdminSettingsTab` | fun AdminSettingsTab( |
| AdminSettingsTab.kt | `AdministrationSection` | private fun AdministrationSection( |
| AdminSettingsTab.kt | `AttachmentLimitsSubsection` | private fun AttachmentLimitsSubsection( |
| AdminSettingsTab.kt | `AuditLogLimitsSubsection` | private fun AuditLogLimitsSubsection( |
| AdminSettingsTab.kt | `CalendarExportSection` | private fun CalendarExportSection( |
| AdminSettingsTab.kt | `DataManagementSection` | private fun DataManagementSection( |
| AdminSettingsTab.kt | `DependentAppsSection` | private fun DependentAppsSection( |
| AdminSettingsTab.kt | `DiagnosticsCard` | private fun DiagnosticsCard(title: String, content: @Composable () -> Unit) |
| AdminSettingsTab.kt | `DiagnosticsLine` | private fun DiagnosticsLine(label: String, value: String) |
| AdminSettingsTab.kt | `HomeAssistantSection` | private fun HomeAssistantSection( |
| AdminSettingsTab.kt | `ImportBatchesSubsection` | private fun ImportBatchesSubsection() |
| AdminSettingsTab.kt | `KioskSection` | private fun KioskSection( |
| AdminSettingsTab.kt | `KioskTagTreeNode` | private fun KioskTagTreeNode( |
| AdminSettingsTab.kt | `NtfySection` | private fun NtfySection( |
| AdminSettingsTab.kt | `SettingsDropdown` | private fun SettingsDropdown( |
| AdminSettingsTab.kt | `TailscaleSection` | private fun TailscaleSection( |
| AdminSettingsTab.kt | `VersionUpdatesSection` | private fun VersionUpdatesSection( |
| AdminSettingsTab.kt | `buildKioskTagTree` | private fun buildKioskTagTree(tagNames: List<String>): List<KioskTagNode> |
| AdminSettingsTab.kt | `formatBytes` | private fun formatBytes(bytes: Long): String |
| AdminSettingsTab.kt | `formatVersionDate` | private fun formatVersionDate(isoDatetime: String, timeFormat: String): String |
| AdminSettingsTab.kt | `getAppVersion` | private fun getAppVersion(): String |
| AdminSettingsTab.kt | `parseKioskSelectedTags` | private fun parseKioskSelectedTags(json: String): List<String> |
| AdminSettingsTab.kt | `parseKioskTagsFromJson` | private fun parseKioskTagsFromJson(json: String, systemTags: Set<String>): List<String> |
| BadgesSettingsTab.kt | `BadgeCollapsibleHeader` | private fun BadgeCollapsibleHeader( |
| BadgesSettingsTab.kt | `BadgeDisplaySection` | private fun BadgeDisplaySection( |
| BadgesSettingsTab.kt | `BadgeDropdown` | private fun BadgeDropdown( |
| BadgesSettingsTab.kt | `BadgesSettingsTab` | fun BadgesSettingsTab( |
| BadgesSettingsTab.kt | `BuiltInDetectorsSection` | private fun BuiltInDetectorsSection( |
| BadgesSettingsTab.kt | `CustomDetectorCard` | private fun CustomDetectorCard( |
| BadgesSettingsTab.kt | `CustomDetectorsSection` | private fun CustomDetectorsSection( |
| BadgesSettingsTab.kt | `DetectorEditDialog` | private fun DetectorEditDialog( |
| BadgesSettingsTab.kt | `parseBadgeDetectorsJson` | private fun parseBadgeDetectorsJson(json: String): List<BadgeDetector> |
| BadgesSettingsTab.kt | `serializeBadgeDetectorsJson` | private fun serializeBadgeDetectorsJson(detectors: List<BadgeDetector>): String |
| BadgesSettingsTab.kt | `updateDetectorEnabled` | private fun updateDetectorEnabled( |
| CollectionsSettingsTab.kt | `BorderColorAssignmentDialog` | private fun BorderColorAssignmentDialog( |
| CollectionsSettingsTab.kt | `CollapsibleSectionHeader` | private fun CollapsibleSectionHeader( |
| CollectionsSettingsTab.kt | `CollectionsSettingsTab` | fun CollectionsSettingsTab( |
| CollectionsSettingsTab.kt | `ColorEditDialog` | private fun ColorEditDialog( |
| CollectionsSettingsTab.kt | `ColorSwatchWithBorderIndicator` | private fun ColorSwatchWithBorderIndicator( |
| CollectionsSettingsTab.kt | `CustomColorsSection` | private fun CustomColorsSection( |
| CollectionsSettingsTab.kt | `DefaultNotificationsSection` | private fun DefaultNotificationsSection( |
| CollectionsSettingsTab.kt | `EnhancedTagEditDialog` | private fun EnhancedTagEditDialog( |
| CollectionsSettingsTab.kt | `LocationEditDialog` | private fun LocationEditDialog( |
| CollectionsSettingsTab.kt | `LocationRow` | private fun LocationRow( |
| CollectionsSettingsTab.kt | `NotificationOffsetDialog` | private fun NotificationOffsetDialog( |
| CollectionsSettingsTab.kt | `NotificationRuleRow` | private fun NotificationRuleRow( |
| CollectionsSettingsTab.kt | `SavedLocationsSection` | private fun SavedLocationsSection( |
| CollectionsSettingsTab.kt | `TagEditorSection` | private fun TagEditorSection( |
| CollectionsSettingsTab.kt | `TagTreeNodeRow` | private fun TagTreeNodeRow( |
| CollectionsSettingsTab.kt | `buildTagTree` | private fun buildTagTree(tags: List<TagItem>): List<TagTreeNode> |
| CollectionsSettingsTab.kt | `inheritColors` | fun inheritColors(nodes: MutableList<TagTreeNode>, parentColor: String?) |
| CollectionsSettingsTab.kt | `isLightColor` | private fun isLightColor(hex: String): Boolean |
| CollectionsSettingsTab.kt | `offsetMinutesToValueUnit` | private fun offsetMinutesToValueUnit(offsetMinutes: Int): Pair<Int, String> |
| CollectionsSettingsTab.kt | `parseColorsJson` | private fun parseColorsJson(json: String): List<String> |
| CollectionsSettingsTab.kt | `parseHexColor` | private fun parseHexColor(hex: String): Color |
| CollectionsSettingsTab.kt | `parseLocationsJson` | private fun parseLocationsJson(json: String): List<LocationItem> |
| CollectionsSettingsTab.kt | `parseNotificationsJson` | private fun parseNotificationsJson(json: String): NotificationsData |
| CollectionsSettingsTab.kt | `parseTagsJson` | private fun parseTagsJson(json: String): List<TagItem> |
| CollectionsSettingsTab.kt | `serializeColorsJson` | private fun serializeColorsJson(colors: List<String>): String |
| CollectionsSettingsTab.kt | `serializeLocationsJson` | private fun serializeLocationsJson(locations: List<LocationItem>): String |
| CollectionsSettingsTab.kt | `serializeNotificationsJson` | private fun serializeNotificationsJson(data: NotificationsData): String |
| CollectionsSettingsTab.kt | `serializeTagsJson` | private fun serializeTagsJson(tags: List<TagItem>): String |
| CollectionsSettingsTab.kt | `sortLevel` | fun sortLevel(nodes: MutableList<TagTreeNode>) |
| DebugViewModel.kt | `fullResync` | fun fullResync() |
| DebugViewModel.kt | `loadDebugInfo` | private fun loadDebugInfo() |
| DebugViewModel.kt | `syncNow` | fun syncNow() |
| EmailSettingsTab.kt | `AccountsSyncingSection` | private fun AccountsSyncingSection( |
| EmailSettingsTab.kt | `BadgesSection` | private fun BadgesSection( |
| EmailSettingsTab.kt | `CustomDetectorEditDialog` | private fun CustomDetectorEditDialog( |
| EmailSettingsTab.kt | `DisplayBundlesSection` | private fun DisplayBundlesSection( |
| EmailSettingsTab.kt | `EmailAccountCard` | private fun EmailAccountCard( |
| EmailSettingsTab.kt | `EmailAccountEditDialog` | private fun EmailAccountEditDialog( |
| EmailSettingsTab.kt | `EmailCollapsibleHeader` | private fun EmailCollapsibleHeader( |
| EmailSettingsTab.kt | `EmailDropdown` | private fun EmailDropdown( |
| EmailSettingsTab.kt | `EmailSettingsTab` | fun EmailSettingsTab( |
| EmailSettingsTab.kt | `PrivacySendingSection` | private fun PrivacySendingSection( |
| EmailSettingsTab.kt | `parseBadgeConfig` | private fun parseBadgeConfig(json: String): BadgeConfig |
| EmailSettingsTab.kt | `parseEmailAccountsJson` | private fun parseEmailAccountsJson(json: String): List<EmailAccount> |
| EmailSettingsTab.kt | `serializeBadgeConfig` | private fun serializeBadgeConfig(config: BadgeConfig): String |
| EmailSettingsTab.kt | `serializeEmailAccountsJson` | private fun serializeEmailAccountsJson(accounts: List<EmailAccount>): String |
| GeneralSettingsTab.kt | `CustomFiltersSection` | private fun CustomFiltersSection( |
| GeneralSettingsTab.kt | `GeneralSettingsTab` | fun GeneralSettingsTab( |
| GeneralSettingsTab.kt | `SettingsDropdown` | private fun SettingsDropdown( |
| GeneralSettingsTab.kt | `TimezoneOverrideField` | private fun TimezoneOverrideField( |
| GeneralSettingsTab.kt | `TimezoneSearchField` | private fun TimezoneSearchField( |
| GeneralSettingsTab.kt | `VisualIndicatorRow` | private fun VisualIndicatorRow( |
| GeneralSettingsTab.kt | `calendarSnapDisplayLabel` | private fun calendarSnapDisplayLabel(value: String): String |
| GeneralSettingsTab.kt | `nearestValidOption` | fun nearestValidOption(value: String, validOptions: List<String>): String |
| GeneralSettingsTab.kt | `updateCombineAlerts` | fun updateCombineAlerts(checked: Boolean) |
| GeneralSettingsTab.kt | `updateIndicator` | fun updateIndicator(key: String, value: String) |
| SettingsScreen.kt | `SettingsScreen` | fun SettingsScreen( |
| SettingsViewModel.kt | `buildSavePayload` | fun buildSavePayload(): Map<String, Any?> |
| SettingsViewModel.kt | `clearLoadError` | fun clearLoadError() |
| SettingsViewModel.kt | `clearSaveError` | fun clearSaveError() |
| SettingsViewModel.kt | `connectTailscale` | fun connectTailscale() |
| SettingsViewModel.kt | `disableNtfy` | fun disableNtfy() |
| SettingsViewModel.kt | `discardChanges` | fun discardChanges() |
| SettingsViewModel.kt | `disconnectTailscale` | fun disconnectTailscale() |
| SettingsViewModel.kt | `enableNtfy` | fun enableNtfy() |
| SettingsViewModel.kt | `initTailscaleSavedState` | fun initTailscaleSavedState() |
| SettingsViewModel.kt | `loadBundles` | private fun loadBundles() |
| SettingsViewModel.kt | `loadHaConfig` | fun loadHaConfig() |
| SettingsViewModel.kt | `loadSettings` | private fun loadSettings() |
| SettingsViewModel.kt | `mapEntityToFormState` | private fun mapEntityToFormState(entity: SettingsEntity): SettingsFormState |
| SettingsViewModel.kt | `mapFormStateToEntity` | private fun mapFormStateToEntity(formState: SettingsFormState): SettingsEntity |
| SettingsViewModel.kt | `refreshNtfyStatus` | fun refreshNtfyStatus() |
| SettingsViewModel.kt | `refreshTailscaleStatus` | fun refreshTailscaleStatus() |
| SettingsViewModel.kt | `regenerateHaWebhook` | fun regenerateHaWebhook() |
| SettingsViewModel.kt | `resetSortOrders` | fun resetSortOrders() |
| SettingsViewModel.kt | `sanitizeMapFields` | private fun sanitizeMapFields(formState: SettingsFormState): SettingsFormState |
| SettingsViewModel.kt | `save` | fun save() |
| SettingsViewModel.kt | `saveAndExit` | fun saveAndExit() |
| SettingsViewModel.kt | `saveAndStay` | fun saveAndStay() |
| SettingsViewModel.kt | `saveHaConfig` | fun saveHaConfig(baseUrl: String, accessToken: String, pollInterval: Int) |
| SettingsViewModel.kt | `saveTailscaleConfig` | fun saveTailscaleConfig(authKey: String, enabled: Boolean) |
| SettingsViewModel.kt | `setRawServerSettings` | fun setRawServerSettings(raw: Map<String, Any?>) |
| SettingsViewModel.kt | `testEmailConnection` | fun testEmailConnection( |
| SettingsViewModel.kt | `testHaConnection` | fun testHaConnection() |
| SettingsViewModel.kt | `testNtfyNotification` | fun testNtfyNotification() |
| SettingsViewModel.kt | `toggleBundle` | fun toggleBundle(bundleId: String, enable: Boolean) |
| SettingsViewModel.kt | `triggerBackfill` | fun triggerBackfill() |
| SettingsViewModel.kt | `updateSetting` | fun updateSetting(key: String, value: String) |
| SettingsViewModel.kt | `validateBadgeDetectors` | private fun validateBadgeDetectors(detectorsJson: String): String? |
| SettingsViewModel.kt | `validateSettings` | private fun validateSettings(formState: SettingsFormState): String? |
| ViewsSettingsTab.kt | `BundleOmniToggles` | private fun BundleOmniToggles( |
| ViewsSettingsTab.kt | `CalendarSection` | private fun CalendarSection( |
| ViewsSettingsTab.kt | `ColorModeSelector` | private fun ColorModeSelector( |
| ViewsSettingsTab.kt | `DefaultViewDropdown` | private fun DefaultViewDropdown( |
| ViewsSettingsTab.kt | `EmailsToShowDropdown` | private fun EmailsToShowDropdown( |
| ViewsSettingsTab.kt | `EnabledPeriodsSection` | private fun EnabledPeriodsSection( |
| ViewsSettingsTab.kt | `HabitsSection` | private fun HabitsSection( |
| ViewsSettingsTab.kt | `HourDropdown` | private fun HourDropdown( |
| ViewsSettingsTab.kt | `HstBarClockSelector` | private fun HstBarClockSelector( |
| ViewsSettingsTab.kt | `LockedFilterDefaults` | private fun LockedFilterDefaults( |
| ViewsSettingsTab.kt | `MapsSection` | private fun MapsSection( |
| ViewsSettingsTab.kt | `OmniViewSection` | private fun OmniViewSection( |
| ViewsSettingsTab.kt | `ProjectsSection` | private fun ProjectsSection( |
| ViewsSettingsTab.kt | `ScrollToHourDropdown` | private fun ScrollToHourDropdown( |
| ViewsSettingsTab.kt | `ViewHoursSection` | private fun ViewHoursSection( |
| ViewsSettingsTab.kt | `ViewOrderSection` | private fun ViewOrderSection( |
| ViewsSettingsTab.kt | `ViewsSettingsTab` | fun ViewsSettingsTab( |
| ViewsSettingsTab.kt | `WeekStartDayDropdown` | private fun WeekStartDayDropdown( |
| ViewsSettingsTab.kt | `WorkDaysCheckboxes` | private fun WorkDaysCheckboxes( |
| ViewsSettingsTab.kt | `WorkHoursSection` | private fun WorkHoursSection( |
| ViewsSettingsTab.kt | `XDaysCountInput` | private fun XDaysCountInput( |
| ViewsSettingsTab.kt | `jsonArrayToStringList` | private fun jsonArrayToStringList(arr: JSONArray?): List<String> |
| ViewsSettingsTab.kt | `parseOmniLayout` | private fun parseOmniLayout(json: String): OmniLayout |
| ViewsSettingsTab.kt | `serializeOmniLayout` | private fun serializeOmniLayout(layout: OmniLayout): String |

## ui/screens/settings/components/

| File | Function | Signature |
|------|----------|----------|
| CollapsibleSection.kt | `CollapsibleSection` | fun CollapsibleSection( |
| CustomFilterModal.kt | `CustomFilterModal` | fun CustomFilterModal( |
| CustomFilterModal.kt | `DisplayTogglesGroup` | private fun DisplayTogglesGroup( |
| CustomFilterModal.kt | `FilterGroup` | private fun FilterGroup( |
| CustomFilterModal.kt | `MultiSelectChipGroup` | private fun MultiSelectChipGroup( |
| CustomFilterModal.kt | `ProjectSingleSelect` | private fun ProjectSingleSelect( |
| CustomFilterModal.kt | `SortDirectionToggle` | private fun SortDirectionToggle( |
| CustomFilterModal.kt | `SortFieldDropdown` | private fun SortFieldDropdown( |
| CustomFilterModal.kt | `isDefaultFilter` | private fun isDefaultFilter(filter: CustomViewFilter): Boolean |
| DragGrid.kt | `DragGrid` | fun DragGrid( |
| DragGrid.kt | `DragGridItem` | private fun DragGridItem( |
| DragGrid.kt | `DragZoneSection` | private fun DragZoneSection( |
| DragGrid.kt | `handleDragEnd` | private fun handleDragEnd( |
| DragGrid.kt | `isPointInRect` | private fun isPointInRect( |
| OmniLayoutModal.kt | `EmptyZoneHint` | private fun EmptyZoneHint(text: String) |
| OmniLayoutModal.kt | `OmniLayoutModal` | fun OmniLayoutModal( |
| OmniLayoutModal.kt | `SectionCard` | private fun SectionCard( |
| OmniLayoutModal.kt | `ZoneHeader` | private fun ZoneHeader(title: String, isUnused: Boolean = false) |
| OmniLayoutModal.kt | `ZoneMoveButton` | private fun ZoneMoveButton( |
| OmniLayoutModal.kt | `buildLayoutFromSections` | private fun buildLayoutFromSections(sections: List<ZonedSection>): OmniLayout |
| OmniLayoutModal.kt | `getDefaultOmniLayout` | fun getDefaultOmniLayout(): OmniLayout |
| OmniLayoutModal.kt | `moveToZone` | private fun moveToZone( |
| OmniLayoutModal.kt | `moveWithinZone` | private fun moveWithinZone( |
| SignatureEditorModal.kt | `SignatureEditorModal` | fun SignatureEditorModal( |
| SignatureEditorModal.kt | `wrapSelection` | private fun wrapSelection( |
| UpgradeModal.kt | `UpgradeModal` | fun UpgradeModal( |
| UpgradeModal.kt | `startUpgrade` | fun startUpgrade() |

## ui/screens/tasks/

| File | Function | Signature |
|------|----------|----------|
| TasksScreen.kt | `FilteredEmptyState` | private fun FilteredEmptyState(onClearFilters: () -> Unit) |
| TasksScreen.kt | `HabitCard` | private fun HabitCard(chit: ChitEntity, section: String, onClick: () -> Unit, onIncrement: () -> Unit |
| TasksScreen.kt | `HabitIndicatorRow` | private fun HabitIndicatorRow( |
| TasksScreen.kt | `HabitsView` | private fun HabitsView( |
| TasksScreen.kt | `IndicatorIcons` | private fun IndicatorIcons(task: ChitEntity, textColor: Color, isSubChit: Boolean = false, currentUserId: String = "") |
| TasksScreen.kt | `MetaChip` | private fun MetaChip(text: String, isSortActive: Boolean, sortDir: SortDirection, color: Color) |
| TasksScreen.kt | `MetaValuesRow` | private fun MetaValuesRow(task: ChitEntity, sortState: SortState, textColor: Color) |
| TasksScreen.kt | `NotePreview` | private fun NotePreview(note: String, expanded: Boolean, onToggle: () -> Unit, textColor: Color) |
| TasksScreen.kt | `StatusDropdownRow` | private fun StatusDropdownRow( |
| TasksScreen.kt | `TaskCard` | private fun TaskCard( |
| TasksScreen.kt | `TasksEmptyState` | private fun TasksEmptyState() |
| TasksScreen.kt | `TasksFlatList` | private fun TasksFlatList( |
| TasksScreen.kt | `TasksLoadingSkeleton` | private fun TasksLoadingSkeleton() |
| TasksScreen.kt | `TasksScreen` | fun TasksScreen( |
| TasksScreen.kt | `formatResetPeriod` | private fun formatResetPeriod(resetPeriod: String?): String? |
| TasksScreen.kt | `getResetEndDateFormatted` | private fun getResetEndDateFormatted(chit: ChitEntity): String? |
| TasksScreen.kt | `habitUrgencyScore` | private fun habitUrgencyScore(chit: ChitEntity): Float |
| TasksScreen.kt | `isResetPeriodActive` | private fun isResetPeriodActive(chit: ChitEntity): Boolean |
| TasksScreen.kt | `parseResetPeriod` | private fun parseResetPeriod(resetPeriod: String): Pair<Int, String> |
| TasksScreen.kt | `parseWeatherEmojiFromJson` | private fun parseWeatherEmojiFromJson(weatherJson: String?): String |
| TasksScreen.kt | `priorityColor` | private fun priorityColor(priority: String): Color = when (priority) |
| TasksScreen.kt | `sortArrow` | private fun sortArrow(dir: SortDirection): String = if (dir == SortDirection.ASC) " ▲" else " ▼" |
| TasksScreen.kt | `statusColor` | private fun statusColor(status: String): Color = when (status) |
| TasksScreen.kt | `statusIcon` | private fun statusIcon(status: String?): String = when (status) |
| TasksScreen.kt | `statusWeight` | private fun statusWeight(status: String?): Int = when (status) |
| TasksViewModel.kt | `finalizeDelete` | fun finalizeDelete(chitId: String? = null) |
| TasksViewModel.kt | `softDelete` | fun softDelete(chitId: String) |
| TasksViewModel.kt | `undoDelete` | fun undoDelete() |
| TasksViewModel.kt | `updateRsvp` | fun updateRsvp(chitId: String, rsvpStatus: String) |

## ui/screens/trash/

| File | Function | Signature |
|------|----------|----------|
| TrashScreen.kt | `PurgeConfirmationDialog` | private fun PurgeConfirmationDialog( |
| TrashScreen.kt | `TrashChitCard` | private fun TrashChitCard( |
| TrashScreen.kt | `TrashEmptyState` | private fun TrashEmptyState(modifier: Modifier = Modifier) |
| TrashScreen.kt | `TrashFilterChips` | private fun TrashFilterChips( |
| TrashScreen.kt | `TrashList` | private fun TrashList( |
| TrashScreen.kt | `TrashScreen` | fun TrashScreen( |
| TrashScreen.kt | `buildChitTypeChips` | private fun buildChitTypeChips(chit: ChitEntity): List<String> |
| TrashViewModel.kt | `bulkPurge` | fun bulkPurge() |
| TrashViewModel.kt | `bulkRestore` | fun bulkRestore() |
| TrashViewModel.kt | `deselectAll` | fun deselectAll() |
| TrashViewModel.kt | `isAllSelected` | fun isAllSelected(chits: List<ChitEntity>): Boolean |
| TrashViewModel.kt | `isSelected` | fun isSelected(chitId: String): Boolean = chitId in _selectedIds.value |
| TrashViewModel.kt | `purge` | fun purge(chitId: String) |
| TrashViewModel.kt | `restore` | fun restore(chitId: String) |
| TrashViewModel.kt | `selectAll` | fun selectAll(chits: List<ChitEntity>) |
| TrashViewModel.kt | `toggleSelectAll` | fun toggleSelectAll(chits: List<ChitEntity>) |
| TrashViewModel.kt | `toggleSelection` | fun toggleSelection(chitId: String) |

## ui/screens/useradmin/

| File | Function | Signature |
|------|----------|----------|
| UserAdminScreen.kt | `CreateUserDialog` | private fun CreateUserDialog( |
| UserAdminScreen.kt | `EditUserDialog` | private fun EditUserDialog( |
| UserAdminScreen.kt | `EmptyState` | private fun EmptyState() |
| UserAdminScreen.kt | `ErrorState` | private fun ErrorState(message: String, onRetry: () -> Unit) |
| UserAdminScreen.kt | `LoadingState` | private fun LoadingState() |
| UserAdminScreen.kt | `RoleBadge` | private fun RoleBadge(isAdmin: Boolean, isActive: Boolean) |
| UserAdminScreen.kt | `UserAdminScreen` | fun UserAdminScreen( |
| UserAdminScreen.kt | `UserCard` | private fun UserCard( |
| UserAdminScreen.kt | `formatDate` | private fun formatDate(dateStr: String): String |
| UserAdminViewModel.kt | `clearActionMessage` | fun clearActionMessage() |
| UserAdminViewModel.kt | `createUser` | fun createUser( |
| UserAdminViewModel.kt | `deactivateUser` | fun deactivateUser(userId: String) |
| UserAdminViewModel.kt | `loadUsers` | fun loadUsers() |
| UserAdminViewModel.kt | `reactivateUser` | fun reactivateUser(userId: String) |
| UserAdminViewModel.kt | `resetPassword` | fun resetPassword(userId: String, newPassword: String) |
| UserAdminViewModel.kt | `updateUser` | fun updateUser( |

## ui/screens/weather/

| File | Function | Signature |
|------|----------|----------|
| WeatherScreen.kt | `DailyForecastRow` | private fun DailyForecastRow(forecast: DailyForecast) |
| WeatherScreen.kt | `LocationForecastCard` | private fun LocationForecastCard(location: LocationForecast) |
| WeatherScreen.kt | `WeatherContent` | private fun WeatherContent(forecasts: List<LocationForecast>) |
| WeatherScreen.kt | `WeatherEmptyState` | private fun WeatherEmptyState() |
| WeatherScreen.kt | `WeatherErrorState` | private fun WeatherErrorState( |
| WeatherScreen.kt | `WeatherLoadingState` | private fun WeatherLoadingState() |
| WeatherScreen.kt | `WeatherScreen` | fun WeatherScreen( |
| WeatherScreen.kt | `formatForecastDate` | private fun formatForecastDate(dateStr: String): String |
| WeatherScreen.kt | `getDayOfWeek` | private fun getDayOfWeek(year: Int, month: Int, day: Int): Int |
| WeatherScreen.kt | `getWeatherIcon` | private fun getWeatherIcon(code: Int?): String |
| WeatherScreen.kt | `isDateToday` | private fun isDateToday(dateStr: String): Boolean |
| WeatherViewModel.kt | `loadForecasts` | private fun loadForecasts() |
| WeatherViewModel.kt | `mapResponseToForecasts` | private fun mapResponseToForecasts(response: WeatherForecastsResponse): List<LocationForecast> |
| WeatherViewModel.kt | `refresh` | fun refresh() |
| WeatherViewModel.kt | `weatherCodeToCondition` | private fun weatherCodeToCondition(code: Int?): String |

## ui/theme/

| File | Function | Signature |
|------|----------|----------|
| ColorUtils.kt | `applyContactRowColors` | fun applyContactRowColors(colorHex: String?): Pair<Color, Color>? |
| ColorUtils.kt | `computeAutoContrast` | fun computeAutoContrast(backgroundColor: Color): Color |
| ColorUtils.kt | `contactBorderColor` | fun contactBorderColor(colorHex: String?): Color? |
| ColorUtils.kt | `parseHexColor` | fun parseHexColor(hex: String?): Color? |
| ParchmentBackground.kt | `ParchmentBackground` | fun ParchmentBackground( |
| Theme.kt | `CwocTheme` | fun CwocTheme( |

## ui/util/

| File | Function | Signature |
|------|----------|----------|
| DateUtils.kt | `formatDayOfWeek` | fun formatDayOfWeek(isoDatetime: String): String |
| DateUtils.kt | `formatDisplayDate` | fun formatDisplayDate(isoDatetime: String): String |
| DateUtils.kt | `formatDisplayDateTime` | fun formatDisplayDateTime(isoDatetime: String): String |
| DateUtils.kt | `formatDisplayTime` | fun formatDisplayTime(isoDatetime: String): String |
| DateUtils.kt | `formatShortDate` | fun formatShortDate(isoDatetime: String): String |
| DateUtils.kt | `isPast` | fun isPast(isoDatetime: String): Boolean |
| DateUtils.kt | `isToday` | fun isToday(isoDatetime: String): Boolean |
| GeocodingUtil.kt | `clearCache` | fun clearCache() |
| GeocodingUtil.kt | `geocode` | suspend fun geocode(address: String): GeoResult? |
| MarkdownRenderer.kt | `AnnotatedString` | private fun AnnotatedString.Builder.appendInlineFormatted(text: String) |
| MarkdownRenderer.kt | `renderToAnnotatedString` | fun renderToAnnotatedString(markdown: String): AnnotatedString |
| UnitConverter.kt | `formatDistance` | fun formatDistance(km: Double, unitSystem: String): String |
| UnitConverter.kt | `formatHeight` | fun formatHeight(cm: Double, unitSystem: String): String |
| UnitConverter.kt | `formatSpeed` | fun formatSpeed(kmh: Double, unitSystem: String): String |
| UnitConverter.kt | `formatTemperature` | fun formatTemperature(celsius: Double, unitSystem: String): String |
| UnitConverter.kt | `formatWeight` | fun formatWeight(kg: Double, unitSystem: String): String |

## ui/viewmodel/

| File | Function | Signature |
|------|----------|----------|
| FilterSortViewModel.kt | `clearFilters` | fun clearFilters() |
| FilterSortViewModel.kt | `getManualOrder` | fun getManualOrder(): List<String> |
| FilterSortViewModel.kt | `loadSortPreference` | private fun loadSortPreference(tabRoute: String): SortState |
| FilterSortViewModel.kt | `onTabChanged` | fun onTabChanged(tabRoute: String) |
| FilterSortViewModel.kt | `persistSortPreference` | private fun persistSortPreference(tabRoute: String, sort: SortState) |
| FilterSortViewModel.kt | `reorderItems` | fun reorderItems(currentIds: List<String>, fromIndex: Int, toIndex: Int) |
| FilterSortViewModel.kt | `saveManualOrder` | fun saveManualOrder(ids: List<String>) |
| FilterSortViewModel.kt | `updateFilter` | fun updateFilter(filter: FilterState) |
| FilterSortViewModel.kt | `updateSort` | fun updateSort(sort: SortState) |
| ProfileMenuViewModel.kt | `acceptNotification` | fun acceptNotification(notificationId: String) |
| ProfileMenuViewModel.kt | `declineNotification` | fun declineNotification(notificationId: String) |
| ProfileMenuViewModel.kt | `dismissNotification` | fun dismissNotification(notificationId: String) |
| ProfileMenuViewModel.kt | `fetchNotifications` | fun fetchNotifications() |
| ProfileMenuViewModel.kt | `removeFromList` | private fun removeFromList(notificationId: String) |
| ProfileMenuViewModel.kt | `snoozeNotification` | fun snoozeNotification(notificationId: String) |
| SidebarStateViewModel.kt | `deleteSearch` | fun deleteSearch(text: String) |
| SidebarStateViewModel.kt | `goToToday` | fun goToToday() |
| SidebarStateViewModel.kt | `nextPeriod` | fun nextPeriod() |
| SidebarStateViewModel.kt | `persistSavedSearches` | private fun persistSavedSearches() |
| SidebarStateViewModel.kt | `previousPeriod` | fun previousPeriod() |
| SidebarStateViewModel.kt | `restoreFromPrefs` | private fun restoreFromPrefs() |
| SidebarStateViewModel.kt | `saveSearch` | fun saveSearch(text: String) |
| SidebarStateViewModel.kt | `setAlarmsViewMode` | fun setAlarmsViewMode(mode: String) |
| SidebarStateViewModel.kt | `setEmailFolder` | fun setEmailFolder(folder: String) |
| SidebarStateViewModel.kt | `setHabitsIncludeRules` | fun setHabitsIncludeRules(include: Boolean) |
| SidebarStateViewModel.kt | `setHabitsSuccessWindow` | fun setHabitsSuccessWindow(window: Int) |
| SidebarStateViewModel.kt | `setIndicatorsCustomRange` | fun setIndicatorsCustomRange(start: String?, end: String?) |
| SidebarStateViewModel.kt | `setIndicatorsRange` | fun setIndicatorsRange(range: String) |
| SidebarStateViewModel.kt | `setIndicatorsVisibleGraphs` | fun setIndicatorsVisibleGraphs(graphs: Set<String>) |
| SidebarStateViewModel.kt | `setMonthMode` | fun setMonthMode(mode: String) |
| SidebarStateViewModel.kt | `setPeriod` | fun setPeriod(period: String) |
| SidebarStateViewModel.kt | `setProjectsViewMode` | fun setProjectsViewMode(mode: String) |
| SidebarStateViewModel.kt | `setSearchText` | fun setSearchText(text: String) |
| SidebarStateViewModel.kt | `setTasksViewMode` | fun setTasksViewMode(mode: String) |
| SidebarStateViewModel.kt | `updateDateDisplay` | private fun updateDateDisplay() |

## widget/calendar/

| File | Function | Signature |
|------|----------|----------|
| TodayCalendarWidgetProvider.kt | `onUpdate` | override fun onUpdate( |

## widget/quickadd/

| File | Function | Signature |
|------|----------|----------|
| QuickAddWidgetProvider.kt | `onUpdate` | override fun onUpdate( |

## widget/refresh/

| File | Function | Signature |
|------|----------|----------|
| WidgetDataProvider.kt | `getDatabase` | private fun getDatabase(context: Context): CwocDatabase |
| WidgetDataProvider.kt | `getTodayCalendarChits` | suspend fun getTodayCalendarChits(context: Context): List<WidgetCalendarItem> |
| WidgetDataProvider.kt | `getUpcomingTasks` | suspend fun getUpcomingTasks(context: Context): List<WidgetTaskItem> |
| WidgetUpdateWorker.kt | `refreshAllWidgets` | private fun refreshAllWidgets(context: Context) |
| WidgetUpdateWorker.kt | `refreshNow` | fun refreshNow(context: Context) |
| WidgetUpdateWorker.kt | `schedulePeriodic` | fun schedulePeriodic(context: Context) |

## widget/tasks/

| File | Function | Signature |
|------|----------|----------|
| UpcomingTasksWidgetProvider.kt | `onUpdate` | override fun onUpdate( |

