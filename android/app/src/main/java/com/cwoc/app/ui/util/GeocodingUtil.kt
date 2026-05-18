package com.cwoc.app.ui.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Geocoding utility using OpenStreetMap Nominatim API.
 * Resolves text addresses to latitude/longitude coordinates.
 *
 * Addresses gaps H1 (geocoding), H2 (map preview needs coords), H3 (search button),
 * H6 (geocode cache).
 */
object GeocodingUtil {

    data class GeoResult(
        val lat: Double,
        val lon: Double,
        val displayName: String
    )

    // H6: Simple in-memory geocode cache
    private val cache = mutableMapOf<String, GeoResult?>()

    /**
     * Geocode an address string to coordinates using Nominatim.
     * Returns null if geocoding fails or no results found.
     * Results are cached in memory to avoid redundant API calls.
     *
     * @param address The address text to geocode
     * @return GeoResult with lat/lon/displayName, or null
     */
    suspend fun geocode(address: String): GeoResult? {
        if (address.isBlank()) return null

        val cacheKey = address.trim().lowercase()
        if (cache.containsKey(cacheKey)) return cache[cacheKey]

        return withContext(Dispatchers.IO) {
            try {
                val encoded = URLEncoder.encode(address.trim(), "UTF-8")
                val url = URL("https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=1")
                val connection = url.openConnection() as HttpURLConnection
                connection.setRequestProperty("User-Agent", "CWOC-Android/1.0")
                connection.connectTimeout = 5000
                connection.readTimeout = 5000

                val responseCode = connection.responseCode
                if (responseCode != 200) {
                    cache[cacheKey] = null
                    return@withContext null
                }

                val response = connection.inputStream.bufferedReader().readText()
                val jsonArray = JSONArray(response)

                if (jsonArray.length() == 0) {
                    cache[cacheKey] = null
                    return@withContext null
                }

                val first = jsonArray.getJSONObject(0)
                val result = GeoResult(
                    lat = first.getDouble("lat"),
                    lon = first.getDouble("lon"),
                    displayName = first.getString("display_name")
                )

                cache[cacheKey] = result
                result
            } catch (e: Exception) {
                android.util.Log.e("CWOC_GEO", "Geocoding failed: ${e.message}")
                cache[cacheKey] = null
                null
            }
        }
    }

    /**
     * Clear the geocode cache.
     */
    fun clearCache() {
        cache.clear()
    }
}
