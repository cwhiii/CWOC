package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.cwoc.app.data.local.entity.StandaloneAlertEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface StandaloneAlertDao {

    @Query("SELECT * FROM standalone_alerts")
    fun getAll(): Flow<List<StandaloneAlertEntity>>

    @Query("SELECT * FROM standalone_alerts WHERE type = :type")
    fun getByType(type: String): Flow<List<StandaloneAlertEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: StandaloneAlertEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(entities: List<StandaloneAlertEntity>)

    @Update
    suspend fun update(entity: StandaloneAlertEntity)

    @Query("DELETE FROM standalone_alerts WHERE id = :id")
    suspend fun deleteById(id: String)

    @Query("DELETE FROM standalone_alerts")
    suspend fun deleteAll()
}
