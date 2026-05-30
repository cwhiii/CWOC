package com.cwoc.app.data.repository

import android.util.Log
import com.cwoc.app.data.local.dao.WeatherForecastDao
import com.cwoc.app.data.local.entity.WeatherForecastEntity
import com.cwoc.app.data.remote.CwocApiService
import com.cwoc.app.ui.screens.weather.WeatherForecastsResponse
import com.google.gson.Gson
import kotlinx.coroutines.flow.Flow
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "WeatherRepo"

/**
 * Repository for weather forecast data.
 * Fetches from the CWOC server API and caches in Room for offline access.
 * The UI observes the cached data via Flow; refresh triggers a network fetch + cache update.
 */
@Singleton
class WeatherRepository @Inject constructor(
    private val weatherForecastDao: WeatherForecastDao,
    private val apiService: CwocApiService,
    private val gson: Gson
) {

    /** Observe cached weather forecasts reactively. */
    fun observeForecasts(): Flow<List<WeatherForecastEntity>> = weatherForecastDao.getAll()

    /** One-shot read of cached forecasts. */
    suspend fun getCachedForecasts(): List<WeatherForecastEntity> = weatherForecastDao.getAllSnapshot()

    /**
     * Fetch weather forecasts from the server and cache them locally.
     * Returns the server response on success, or null on failure.
     * The cache is always updated on success (old data replaced).
     */
    suspend fun refreshFromServer(): WeatherForecastsResponse? {
        return try {
            val response = apiService.getWeatherForecasts()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null && body.locations.isNotEmpty()) {
                    val now = Instant.now().toString()
                    val entities = body.locations.map { locationDto ->
                        WeatherForecastEntity(
                            locationLabel = locationDto.label,
                            address = locationDto.address,
                            dailyJson = locationDto.daily?.let { gson.toJson(it) },
                            lastFetchedAt = now
                        )
                    }
                    // Replace all cached data with fresh server data
                    weatherForecastDao.deleteAll()
                    weatherForecastDao.upsertAll(entities)
                    Log.d(TAG, "Cached ${entities.size} weather forecasts from server")
                    body
                } else {
                    Log.w(TAG, "Empty weather response from server")
                    null
                }
            } else {
                Log.w(TAG, "Weather fetch failed: HTTP ${response.code()}")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Weather fetch error: ${e.message}", e)
            null
        }
    }
}
