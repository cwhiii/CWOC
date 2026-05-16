package com.cwoc.app.di

import com.cwoc.app.data.sync.ConnectivityMonitor
import com.cwoc.app.data.sync.ConnectivityMonitorImpl
import com.cwoc.app.data.sync.DirtyTracker
import com.cwoc.app.data.sync.DirtyTrackerImpl
import com.cwoc.app.data.sync.SyncPushEngine
import com.cwoc.app.data.sync.SyncPushEngineImpl
import com.cwoc.app.data.sync.SyncStateManager
import com.cwoc.app.data.sync.SyncStateManagerImpl
import com.cwoc.app.data.sync.WebSocketClient
import com.cwoc.app.data.sync.WebSocketClientImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Hilt module that provides all Phase 2 sync infrastructure bindings.
 *
 * Uses @Binds for interface→implementation mappings since all implementations
 * have @Inject constructors. SyncOrchestrator and SyncEngine are concrete
 * @Singleton classes with @Inject constructors, so Hilt auto-provides them
 * without explicit bindings here.
 *
 * Dependencies already provided by other modules:
 * - Gson, OkHttpClient, CwocApiService → NetworkModule
 * - SharedPreferences, CwocDatabase, DAOs → AppModule
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class SyncModule {

    @Binds
    @Singleton
    abstract fun bindConnectivityMonitor(
        impl: ConnectivityMonitorImpl
    ): ConnectivityMonitor

    @Binds
    @Singleton
    abstract fun bindDirtyTracker(
        impl: DirtyTrackerImpl
    ): DirtyTracker

    @Binds
    @Singleton
    abstract fun bindSyncStateManager(
        impl: SyncStateManagerImpl
    ): SyncStateManager

    @Binds
    @Singleton
    abstract fun bindWebSocketClient(
        impl: WebSocketClientImpl
    ): WebSocketClient

    @Binds
    @Singleton
    abstract fun bindSyncPushEngine(
        impl: SyncPushEngineImpl
    ): SyncPushEngine
}
