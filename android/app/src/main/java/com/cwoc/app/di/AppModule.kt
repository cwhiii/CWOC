package com.cwoc.app.di

import android.content.Context
import android.content.SharedPreferences
import androidx.room.Room
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.cwoc.app.data.local.CwocDatabase
import com.cwoc.app.data.local.dao.ChitDao
import com.cwoc.app.data.local.dao.ContactDao
import com.cwoc.app.data.local.dao.SettingsDao
import com.cwoc.app.data.local.dao.SyncMetadataDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideEncryptedSharedPreferences(
        @ApplicationContext context: Context
    ): SharedPreferences {
        val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
        return EncryptedSharedPreferences.create(
            "cwoc_secure_prefs",
            masterKeyAlias,
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    @Provides
    @Singleton
    fun provideCwocDatabase(
        @ApplicationContext context: Context
    ): CwocDatabase {
        return Room.databaseBuilder(
            context,
            CwocDatabase::class.java,
            "cwoc.db"
        ).build()
    }

    @Provides
    fun provideChitDao(db: CwocDatabase): ChitDao = db.chitDao()

    @Provides
    fun provideContactDao(db: CwocDatabase): ContactDao = db.contactDao()

    @Provides
    fun provideSettingsDao(db: CwocDatabase): SettingsDao = db.settingsDao()

    @Provides
    fun provideSyncMetadataDao(db: CwocDatabase): SyncMetadataDao = db.syncMetadataDao()
}
