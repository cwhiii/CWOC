package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity caching weather forecast data fetched from the CWOC server.
 * Each row represents one saved location's full 16-day forecast.
 * The dailyJson field stores the raw Open-Meteo daily data as a JSON string.
 *
 * Data is refreshed on each sync cycle and served from cache when offline.
 */
@Entity(tableName = "weather_forecasts")
data class WeatherForecastEntity(
    /** Location label (e.g., "Home", "Office") — unique per user. */
    @PrimaryKey val locationLabel: String,
    /** Full address string for the location. */
    val address: String?,
    /**
     * JSON string of the daily forecast data matching the server response format:
     * {"time":["2025-01-01",...], "temperature_2m_max":[...], "temperature_2m_min":[...],
     *  "precipitation_sum":[...], "weathercode":[...], "wind_speed_10m_max":[...]}
     */
    val dailyJson: String?,
    /** ISO timestamp of when this forecast was last fetched from the server. */
    val lastFetchedAt: String?
)
