package com.cwoc.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.cwoc.app.data.local.entity.WeatherForecastEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface WeatherForecastDao {

    /** Observe all cached weather forecasts reactively. */
    @Query("SELECT * FROM weather_forecasts")
    fun getAll(): Flow<List<WeatherForecastEntity>>

    /** One-shot read of all cached forecasts. */
    @Query("SELECT * FROM weather_forecasts")
    suspend fun getAllSnapshot(): List<WeatherForecastEntity>

    /** Replace all cached forecasts with fresh data from the server. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(forecasts: List<WeatherForecastEntity>)

    /** Clear all cached forecasts (used before a full refresh). */
    @Query("DELETE FROM weather_forecasts")
    suspend fun deleteAll()
}
