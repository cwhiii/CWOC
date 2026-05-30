package com.cwoc.app.data.remote.dto

import com.google.gson.annotations.SerializedName

// DTOs for the Restic Backup management API (/api/backup/).
// All fields nullable where the server may omit them.

data class BackupTargetDto(
    @SerializedName("id") val id: String?,
    @SerializedName("name") val name: String?,
    @SerializedName("configured") val configured: Boolean?,
    @SerializedName("enabled") val enabled: Boolean?,
    @SerializedName("repo_type") val repo_type: String?,
    @SerializedName("repo_url") val repo_url: String?,
    @SerializedName("repo_password") val repo_password: String?,
    @SerializedName("backend_credentials") val backend_credentials: Map<String, String>?,
    @SerializedName("backup_paths") val backup_paths: List<String>?,
    @SerializedName("schedule_frequency") val schedule_frequency: String?,
    @SerializedName("schedule_time") val schedule_time: String?,
    @SerializedName("retention_policy") val retention_policy: RetentionPolicyDto?,
    @SerializedName("notification_recipients") val notification_recipients: NotificationRecipientsDto?,
    @SerializedName("notification_transfer") val notification_transfer: Boolean?,
    @SerializedName("notification_maintenance") val notification_maintenance: Boolean?,
    @SerializedName("last_backup_time") val last_backup_time: String?,
    @SerializedName("last_backup_result") val last_backup_result: BackupResultDto?,
    @SerializedName("next_backup_time") val next_backup_time: String?,
    @SerializedName("repo_size") val repo_size: String?
)

data class BackupTargetsResponseDto(
    @SerializedName("targets") val targets: List<BackupTargetDto>,
    @SerializedName("orphans") val orphans: List<OrphanRepoDto>?
)

data class OrphanRepoDto(
    @SerializedName("path") val path: String,
    @SerializedName("repo_size") val repo_size: String?
)

data class RetentionPolicyDto(
    @SerializedName("keep_last") val keep_last: Int?,
    @SerializedName("keep_daily") val keep_daily: Int?,
    @SerializedName("keep_weekly") val keep_weekly: Int?,
    @SerializedName("keep_monthly") val keep_monthly: Int?,
    @SerializedName("keep_yearly") val keep_yearly: Int?
)

data class NotificationRecipientsDto(
    @SerializedName("admins") val admins: String?,
    @SerializedName("trigger") val trigger: String?
)

data class BackupResultDto(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("message") val message: String?,
    @SerializedName("snapshot_id") val snapshot_id: String?,
    @SerializedName("duration") val duration: Double?
)

data class BackupSnapshotDto(
    @SerializedName("id") val id: String,
    @SerializedName("short_id") val short_id: String?,
    @SerializedName("time") val time: String?,
    @SerializedName("hostname") val hostname: String?,
    @SerializedName("paths") val paths: List<String>?,
    @SerializedName("summary") val summary: SnapshotSummaryDto?
)

data class SnapshotSummaryDto(
    @SerializedName("total_size") val total_size: Long?
)

data class BackupSnapshotsResponseDto(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("snapshots") val snapshots: List<BackupSnapshotDto>?,
    @SerializedName("error") val error: String?,
    @SerializedName("message") val message: String?
)

data class BackupOperationResponseDto(
    @SerializedName("success") val success: Boolean?,
    @SerializedName("message") val message: String?,
    @SerializedName("snapshot_id") val snapshot_id: String?,
    @SerializedName("duration") val duration: Double?,
    @SerializedName("error") val error: String?,
    @SerializedName("details") val details: String?,
    @SerializedName("snapshots_removed") val snapshots_removed: Int?,
    @SerializedName("space_reclaimed") val space_reclaimed: String?,
    @SerializedName("results") val results: List<BackupOperationResponseDto>?,
    @SerializedName("id") val id: String?,
    @SerializedName("data_deleted") val data_deleted: Boolean?
)

data class BackupStatusResponseDto(
    @SerializedName("status") val status: String?,
    @SerializedName("reachable") val reachable: Boolean?,
    @SerializedName("last_check") val last_check: String?,
    @SerializedName("message") val message: String?
)

data class BackupConfigSaveRequestDto(
    @SerializedName("id") val id: String?,
    @SerializedName("name") val name: String,
    @SerializedName("enabled") val enabled: Boolean,
    @SerializedName("repo_type") val repo_type: String,
    @SerializedName("repo_url") val repo_url: String,
    @SerializedName("repo_password") val repo_password: String,
    @SerializedName("backend_credentials") val backend_credentials: Map<String, String>,
    @SerializedName("backup_paths") val backup_paths: List<String>,
    @SerializedName("schedule_frequency") val schedule_frequency: String,
    @SerializedName("schedule_time") val schedule_time: String,
    @SerializedName("retention_policy") val retention_policy: RetentionPolicyDto,
    @SerializedName("notification_recipients") val notification_recipients: NotificationRecipientsDto,
    @SerializedName("notification_transfer") val notification_transfer: Boolean,
    @SerializedName("notification_maintenance") val notification_maintenance: Boolean
)

data class BackupRestoreRequestDto(
    @SerializedName("snapshot_id") val snapshot_id: String,
    @SerializedName("target") val target: String = "/",
    @SerializedName("target_id") val target_id: String? = null
)
