package com.cwoc.app.ui.util

/**
 * BB1: Unit conversion utility.
 * Converts between imperial and metric units based on the user's unit system setting.
 *
 * Used by: weather display (°C/°F), distances (km/mi), health indicators, etc.
 */
object UnitConverter {

    /**
     * Convert temperature based on unit system.
     * @param celsius Temperature in Celsius
     * @param unitSystem "imperial" or "metric"
     * @return Formatted temperature string with unit symbol
     */
    fun formatTemperature(celsius: Double, unitSystem: String): String {
        return if (unitSystem == "imperial") {
            val fahrenheit = celsius * 9.0 / 5.0 + 32.0
            "${fahrenheit.toInt()}°F"
        } else {
            "${celsius.toInt()}°C"
        }
    }

    /**
     * Convert distance based on unit system.
     * @param km Distance in kilometers
     * @param unitSystem "imperial" or "metric"
     * @return Formatted distance string with unit
     */
    fun formatDistance(km: Double, unitSystem: String): String {
        return if (unitSystem == "imperial") {
            val miles = km * 0.621371
            "%.1f mi".format(miles)
        } else {
            "%.1f km".format(km)
        }
    }

    /**
     * Convert speed based on unit system.
     * @param kmh Speed in km/h
     * @param unitSystem "imperial" or "metric"
     * @return Formatted speed string with unit
     */
    fun formatSpeed(kmh: Double, unitSystem: String): String {
        return if (unitSystem == "imperial") {
            val mph = kmh * 0.621371
            "%.0f mph".format(mph)
        } else {
            "%.0f km/h".format(kmh)
        }
    }

    /**
     * Convert weight based on unit system.
     * @param kg Weight in kilograms
     * @param unitSystem "imperial" or "metric"
     * @return Formatted weight string with unit
     */
    fun formatWeight(kg: Double, unitSystem: String): String {
        return if (unitSystem == "imperial") {
            val lbs = kg * 2.20462
            "%.1f lbs".format(lbs)
        } else {
            "%.1f kg".format(kg)
        }
    }

    /**
     * Convert height based on unit system.
     * @param cm Height in centimeters
     * @param unitSystem "imperial" or "metric"
     * @return Formatted height string with unit
     */
    fun formatHeight(cm: Double, unitSystem: String): String {
        return if (unitSystem == "imperial") {
            val totalInches = cm / 2.54
            val feet = (totalInches / 12).toInt()
            val inches = (totalInches % 12).toInt()
            "${feet}'${inches}\""
        } else {
            "${cm.toInt()} cm"
        }
    }
}
