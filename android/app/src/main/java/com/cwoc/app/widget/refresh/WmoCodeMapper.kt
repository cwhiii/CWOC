package com.cwoc.app.widget.refresh

import com.cwoc.app.R

/**
 * Maps WMO weather interpretation codes (0–99) to drawable resource IDs
 * and human-readable condition text (max 20 characters).
 *
 * Reference: WMO Code Table 4677 / Open-Meteo weather codes.
 */
object WmoCodeMapper {

    /**
     * Returns a drawable resource ID for the given WMO weather code.
     * Returns a generic weather icon for any unmapped code.
     */
    fun getWeatherIcon(wmoCode: Int): Int {
        return when (wmoCode) {
            0 -> R.drawable.ic_weather_clear
            1 -> R.drawable.ic_weather_mainly_clear
            2 -> R.drawable.ic_weather_partly_cloudy
            3 -> R.drawable.ic_weather_overcast
            45 -> R.drawable.ic_weather_fog
            48 -> R.drawable.ic_weather_fog
            51 -> R.drawable.ic_weather_drizzle
            53 -> R.drawable.ic_weather_drizzle
            55 -> R.drawable.ic_weather_drizzle
            56 -> R.drawable.ic_weather_freezing_drizzle
            57 -> R.drawable.ic_weather_freezing_drizzle
            61 -> R.drawable.ic_weather_rain
            63 -> R.drawable.ic_weather_rain
            65 -> R.drawable.ic_weather_rain_heavy
            66 -> R.drawable.ic_weather_freezing_rain
            67 -> R.drawable.ic_weather_freezing_rain
            71 -> R.drawable.ic_weather_snow
            73 -> R.drawable.ic_weather_snow
            75 -> R.drawable.ic_weather_snow_heavy
            77 -> R.drawable.ic_weather_snow
            80 -> R.drawable.ic_weather_rain_showers
            81 -> R.drawable.ic_weather_rain_showers
            82 -> R.drawable.ic_weather_rain_heavy
            85 -> R.drawable.ic_weather_snow_showers
            86 -> R.drawable.ic_weather_snow_heavy
            95 -> R.drawable.ic_weather_thunderstorm
            96 -> R.drawable.ic_weather_thunderstorm
            99 -> R.drawable.ic_weather_thunderstorm
            else -> R.drawable.ic_weather_unknown
        }
    }

    /**
     * Returns a human-readable condition text for the given WMO weather code.
     * All returned strings are at most 20 characters long.
     * Returns "Unknown" for any unmapped code.
     */
    fun getConditionText(wmoCode: Int): String {
        return when (wmoCode) {
            0 -> "Clear sky"
            1 -> "Mainly clear"
            2 -> "Partly cloudy"
            3 -> "Overcast"
            45 -> "Fog"
            48 -> "Rime fog"
            51 -> "Light drizzle"
            53 -> "Moderate drizzle"
            55 -> "Dense drizzle"
            56 -> "Lt. freezing drizzle"
            57 -> "Freezing drizzle"
            61 -> "Slight rain"
            63 -> "Moderate rain"
            65 -> "Heavy rain"
            66 -> "Lt. freezing rain"
            67 -> "Heavy freezing rain"
            71 -> "Slight snow"
            73 -> "Moderate snow"
            75 -> "Heavy snow"
            77 -> "Snow grains"
            80 -> "Light rain showers"
            81 -> "Mod. rain showers"
            82 -> "Heavy rain showers"
            85 -> "Light snow showers"
            86 -> "Heavy snow showers"
            95 -> "Thunderstorm"
            96 -> "T-storm w/ hail"
            99 -> "T-storm heavy hail"
            else -> "Unknown"
        }
    }
}
