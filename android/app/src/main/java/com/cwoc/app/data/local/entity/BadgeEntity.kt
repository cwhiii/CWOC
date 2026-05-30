package com.cwoc.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity caching badge data fetched from the CWOC server.
 * Each row represents a single detected smart link (package tracking, flight, hotel, etc.)
 * with its current status and metadata.
 *
 * Data is fetched from GET /api/badges and cached locally for offline access.
 * The cachedAt field tracks when this record was last fetched from the server.
 */
@Entity(tableName = "badges")
data class BadgeEntity(
    /** Unique badge ID from the server. */
    @PrimaryKey val id: String,
    /** ID of the source email chit that triggered detection. */
    val chitId: String,
    /** Badge category: Package, Flight, Hotel, Rental, Event, Restaurant, Transit, Order. */
    val category: String,
    /** Name of the tracking provider (e.g., "UPS", "FedEx", "Delta"). */
    val providerName: String,
    /** Detected tracking/confirmation code. */
    val code: String,
    /** External tracking URL. */
    val url: String,
    /** Optional icon path for the provider. */
    val icon: String?,
    /** Button label for the action (e.g., "Track", "Manage Booking"). */
    val label: String,
    /** Badge status: "active", "completed", or "dismissed". */
    val status: String,
    /** ISO timestamp of when the badge was first detected. */
    val detectedAt: String,
    /** ISO timestamp of the most recent update to this badge. */
    val lastUpdatedAt: String,
    /** ISO timestamp of when the badge was completed/dismissed (nullable). */
    val completedAt: String?,
    /** Subject line of the most recent email referencing this code. */
    val lastEmailSubject: String?,
    /** ISO timestamp of when this record was last fetched from the server. */
    val cachedAt: String
)
