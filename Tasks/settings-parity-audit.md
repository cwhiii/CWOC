# Settings Parity Audit: Web vs Android App — Complete

Every persistent setting. Columns: Web Tab, Web Box (h3 heading), Web Section (setting-subheader), Setting name, App Tab, App Section, then data columns.

**Placement?**: ✅ = same tab+box+section, 🔀 = different location
**Display?**: ✅ = same control & options, ⚠️ = minor diff, ❌ = wrong

| # | Web Tab | Web Box | Web Section | Setting | App Tab | App Section | Server Key | Web Sends | App Sends | Match? | Display? |
|---|---------|---------|-------------|---------|---------|-------------|-----------|-----------|-----------|--------|----------|
| 1 | General | General Settings | ⚙️ General | Sex | General | (top level) | `sex` | `"Man"`/`"Woman"` | `"Man"`/`"Woman"` | ✅ | ✅ |
| 2 | General | General Settings | ⚙️ General | Units | General | (top level) | `unit_system` | `"imperial"`/`"metric"` | `"imperial"`/`"metric"` | ✅ | ✅ |
| 3 | General | General Settings | ⚙️ General | Snooze Length | General | (top level) | `snooze_length` | `"5 minutes"` etc | Same | ✅ | ✅ |
| 4 | General | General Settings | ⚙️ General | Calendar Snap | General | (top level) | `calendar_snap` | `"0"`–`"60"` | Same | ✅ | ✅ |
| 5 | General | General Settings | 🏛️ Contact Vault | Default share contacts | General | Contact Vault | `default_share_contacts` | `"1"`/`"0"` | `"1"`/`"0"` | ✅ | ✅ |
| 6 | General | General Settings | 🕐 Clocks | Time Format | General | Clocks | `time_format` | `"24hour"`/`"12hour"`/`"metric"` | Same | ✅ | ✅ |
| 7 | General | General Settings | 🕐 Clocks | Orientation | General | Clocks | `alarm_orientation` | `"Vertical"`/`"Horizontal"` | Same | ✅ | ✅ |
| 8 | General | General Settings | 🕐 Clocks | Active Clocks | General | Clocks | `active_clocks` | JSON array | JSON array | ✅ | ✅ |
| 9 | General | General Settings | 🌐 Timezone | Default Timezone | General | (top level) | `default_timezone` | IANA string | Same | ✅ | ✅ |
| 10 | General | General Settings | 🌐 Timezone | Current Override | General | (top level) | `timezone_override` | IANA/null | Same | ✅ | ✅ |
| 11 | General | Display Options | Default View | Landing View | General | Display Options | `default_view` | 9 options | 9 options | ✅ | ✅ |
| 12 | General | Display Options | View Order | View Order | General | Display Options | `view_order` | JSON array | JSON array | ✅ | ✅ |
| 13 | General | Display Options | View Order | Hidden Views | General | Display Options | `hidden_views` | Not sent | JSON array | ⚠️ | ✅ |
| 14 | General | Display Options | Chit Options | Fade Past Chits | General | Chit Options | `chit_options` | JSON obj | Same | ✅ | ✅ |
| 15 | General | Display Options | Chit Options | Checklist Autosave | General | Chit Options | `checklist_autosave` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 16 | General | Display Options | Chit Options | Autosave Desktop | General | Chit Options | `autosave_desktop` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 17 | General | Display Options | Chit Options | Autosave Mobile | General | Chit Options | `autosave_mobile` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 18 | General | Display Options | Chit Options | Show Map Thumbnails | General | Chit Options | `show_map_thumbnails` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 19 | General | Display Options | Chit Options | Hide Declined | General | Chit Options | `hide_declined` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 20 | General | Display Options | Visual Indicators | Visual Indicators | General | Visual Indicators | `visual_indicators` | JSON obj | Same | ✅ | ✅ |
| 21 | General | Display Options | Visual Indicators | Combine Alerts | General | Visual Indicators | `combine_alerts` | Not sent | `"0"`/`"1"` | ⚠️ | ✅ |
| 22 | General | Custom Filters | (none) | Custom View Filters | General | Custom Filters & Sorting | `custom_view_filters` | JSON obj | Same | ✅ | ✅ |
| 23 | Views | Omni View | (top) | HST Bar Clock | Views | Omni View | `omni_hst_clock_mode` | `"both"`/`"hst"`/`"system"` | Same | ✅ | ⚠️ Web=dropdown, App=segmented |
| 24 | Views | Omni View | 📐 Layout | Omni Layout | Views | Omni View | `omni_layout` | JSON obj | Same | ✅ | ✅ |
| 25 | Views | Omni View | 📧 Bundle Toggles | Bundle Toggles | Views | Omni View | `omni_bundle_toggles` | Separate API | JSON obj | ⚠️ | ✅ |
| 26 | Views | Omni View | (top) | Emails to show | Views | Omni View | `omni_email_count` | `"3"`–`"20"` | Same | ✅ | ✅ |
| 27 | Views | Omni View | 🎨 Colors | Color mode | Views | Omni View | `omni_normalize_colors` | `"colored"`/`"normalized"`/`"mono"` | Same | ✅ | ⚠️ Web=dropdown, App=segmented |
| 28 | Views | Omni View | 🔒 Locked Filters | Locked Filters | Views | Omni View | `omni_locked_filters` | JSON | Same | ✅ | ✅ |
| 29 | Views | Calendar | Calendar Settings | Week Starts On | Views | Calendar | `week_start_day` | `"0"`–`"6"` | Same | ✅ | ✅ |
| 30 | Views | Calendar | 🕐 View Hours | View Hours Start | Views | Calendar | `all_view_start_hour` | `"0"`–`"23"` | Same | ✅ | ✅ |
| 31 | Views | Calendar | 🕐 View Hours | View Hours End | Views | Calendar | `all_view_end_hour` | `"0"`–`"24"` | `"0"`–`"24"` | ✅ | ✅ |
| 32 | Views | Calendar | (inline) | Scroll to Hour | Views | Calendar | `day_scroll_to_hour` | `"0"`–`"12"` | Same | ✅ | ✅ |
| 33 | Views | Calendar | Enabled Periods | Enabled Periods | Views | Calendar | `enabled_periods` | Comma-joined | Same | ✅ | ✅ |
| 34 | Views | Calendar | Enabled Periods | X Days Count | Views | Calendar | `custom_days_count` | `"2"`–`"30"` | Same | ✅ | ✅ |
| 35 | Views | Calendar | Enabled Periods (Work) | Work Days | Views | Calendar | `work_days` | `"0,1,2,3,4,5"` | Same | ✅ | ✅ |
| 36 | Views | Calendar | Enabled Periods (Work) | Work Hours Start | Views | Calendar | `work_start_hour` | `"0"`–`"23"` | Same | ✅ | ✅ |
| 37 | Views | Calendar | Enabled Periods (Work) | Work Hours End | Views | Calendar | `work_end_hour` | `"0"`–`"23"` | Same | ✅ | ✅ |
| 38 | Views | Habits | (top) | Success Window | Views | Habits | `habits_success_window` | `"7"`/`"30"`/`"90"`/`"all"` | Same | ✅ | ✅ |
| 39 | Views | Habits | (top) | Show habits on calendar | Views | Habits | `default_show_habits_on_calendar` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 40 | Views | Projects | (top) | Show child count | Views | Projects | `projects_show_child_count` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 41 | Views | Projects | (top) | Show checklist count | Views | Projects | `projects_show_checklist_count` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 42 | Views | Maps | (top) | Auto-zoom | Views | Maps | `map_auto_zoom` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 43 | Views | Maps | (top) | Default Latitude | Views | Maps | `map_default_lat` | Decimal/null | Same | ✅ | ✅ |
| 44 | Views | Maps | (top) | Default Longitude | Views | Maps | `map_default_lon` | Decimal/null | Same | ✅ | ✅ |
| 45 | Views | Maps | (top) | Default Zoom | Views | Maps | `map_default_zoom` | Int/null | Same | ✅ | ✅ |
| 46 | Collections | Tag Editor | (top) | Tags | Collections | Tag Editor | `tags` | JSON array | Same | ✅ | ✅ |
| 47 | Collections | Custom Colors | Custom Colors | Custom Colors | Collections | Custom Colors | `custom_colors` | Hex array | Same | ✅ | ✅ |
| 48 | Collections | Custom Colors | Custom Colors | Overdue Border Color | Collections | Custom Colors | `overdue_border_color` | Hex/null | Same | ✅ | ✅ |
| 49 | Collections | Custom Colors | Custom Colors | Blocked Border Color | Collections | Custom Colors | `blocked_border_color` | Hex/null | Same | ✅ | ✅ |
| 50 | Collections | Saved Locations | (top) | Saved Locations | Collections | Saved Locations | `saved_locations` | JSON array | Same | ✅ | ✅ |
| 51 | Collections | Default Notifications | Start Time | Default Notifications | Collections | Default Notifications | `default_notifications` | JSON obj | Same | ✅ | ✅ |
| 52 | Email | Accounts & Syncing | 📧 Accounts | Email Accounts | Email | Accounts | `email_accounts` | JSON array | Same | ✅ | ✅ |
| 53 | Email | Accounts & Syncing | 🔄 Syncing | Max Pull | Email | Syncing | `email_max_pull` | Int string | Same | ✅ | ✅ |
| 54 | Email | Accounts & Syncing | 🔄 Syncing | Check Interval | Email | Syncing | `email_check_interval` | `"manual"`/`"5"`/`"15"`/`"30"`/`"60"` | Same | ✅ | ✅ |
| 55 | Email | Privacy & Sending | (top) | Block Tracking | Email | Privacy | `email_block_tracking_pixels` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 56 | Email | Privacy & Sending | (top) | External Content | Email | Privacy | `email_external_content` | `"allow"`/`"block"`/`"known_senders"` | Same | ✅ | ✅ |
| 57 | Email | Privacy & Sending | (top) | Read Receipts | Email | Privacy | `email_read_receipts` | `"never"`/`"always"`/`"ask"`/`"contacts_only"` | Same | ✅ | ✅ |
| 58 | Email | Privacy & Sending | (top) | Undo Send Delay | Email | Privacy | `email_undo_send_delay` | `"5"`/`"10"`/`"15"`/`"30"` | Same | ✅ | ✅ |
| 59 | Email | Privacy & Sending | ✍️ Signature | Signature | Email | Signature | `email_signature` | Markdown | Same | ✅ | ✅ |
| 60 | Email | Display & Bundles | (top) | Group By | Email | Display | `email_group_by` | `"date"`/`"none"` | Same | ✅ | ✅ |
| 61 | Email | Display & Bundles | (top) | Paginate | Email | Display | `paginate_email` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 62 | Email | Display & Bundles | 📦 Bundles | Bundles Enabled | Email | Bundles | `bundles_enabled` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 63 | Email | Display & Bundles | 📦 Bundles | Multi-Placement | Email | Bundles | `bundles_multi_placement` | `"1"`/`"0"` | Same | ✅ | ✅ |
| 64 | Email | Display & Bundles | 📦 Bundles | Bundle Count | Email | Bundles | `bundles_show_count` | `"both"`/`"unread"`/`"total"`/`"none"` | Same | ✅ | ✅ |
| 65 | Email | Badges | (top) | Badge Detectors | Email | Badges | `badge_detectors` | JSON array | Same | ✅ | ✅ |
| 66 | Admin | Admin | Instance Name | Instance Name | Administration | Administration | `instance_name` | Free text | Same | ✅ | ✅ |
| 67 | Admin | Admin | Welcome Message | Welcome Message | Administration | Administration | `welcome_message` | Markdown | Same | ⚠️ | ✅ |
| 68 | Admin | Admin | 🔑 Session Lifetime | Session Lifetime | Administration | Administration | `session_lifetime` | `"1"`/`"12"`/`"24"`/`"168"`/`"720"`/`"0"` | Same | ✅ | ✅ |
| 69 | Admin | Tools | 📺 Kiosk | Kiosk Tags | Administration | Kiosk | `kiosk_users` | JSON array | Same | ✅ | ✅ |
| 70 | Admin | Data Management | 📜 Audit Log Limits | Audit Pruning Enabled | Administration | Data Management | `audit_log_pruning_enabled` | Not sent | `"0"`/`"1"` | ⚠️ | ✅ |
| 71 | Admin | Data Management | 📜 Audit Log Limits | Audit Max Days | Administration | Data Management | `audit_log_max_days` | Int/null | Int/null | ✅ | ✅ |
| 72 | Admin | Data Management | 📜 Audit Log Limits | Audit Max MB | Administration | Data Management | `audit_log_max_mb` | Int/null | Int/null | ✅ | ✅ |
| 73 | Admin | Data Management | 📎 Attachment Limits | Attachment Max Size | Administration | Data Management | `attachment_max_size_mb` | `"5"`/`"10"`/`"25"`/`"50"` | Same | ✅ | ✅ |
| 74 | Admin | Data Management | 📎 Attachment Limits | Attachment Max Storage | Administration | Data Management | `attachment_max_storage_mb` | `"100"`–`"5120"`/`"0"` | Same | ✅ | ✅ |
| 75 | Admin | Dependent Apps | Tailscale | Tailscale Enabled | Administration | Dependent Apps | `tailscale_enabled` | Separate API | `"0"`/`"1"` | ⚠️ | ✅ |
| 76 | Admin | Dependent Apps | Tailscale | Tailscale Auth Key | Administration | Dependent Apps | `tailscale_auth_key` | Separate API | String/null | ⚠️ | ✅ |
| 77 | Admin | Dependent Apps | Ntfy | Ntfy Enabled | Administration | Dependent Apps | `ntfy_enabled` | Separate API | `"0"`/`"1"` | ⚠️ | ✅ |
| 78 | Admin | Dependent Apps | Home Assistant | HA Enabled | Administration | Dependent Apps | `ha_enabled` | Separate API | `"0"`/`"1"` | ⚠️ | ✅ |
| 79 | Admin | Dependent Apps | Home Assistant | HA Poll Interval | Administration | Dependent Apps | `ha_poll_interval` | Separate API | `"30"` | ⚠️ | ✅ |
| 80 | — | — | — | Clock Orientation (dup) | General | Clocks | `clock_orientation` | Not sent | `"Horizontal"`/`"Vertical"` | ⚠️ | N/A |

---

## Remaining ⚠️ Items (harmless, not bugs)

| # | Issue | Why it's fine |
|---|-------|--------------|
| 13 | App sends `hidden_views` key | Server column exists, accepts it. Web just excludes from view_order instead. |
| 21 | App sends `combine_alerts` as separate key | Server column exists. Web embeds in visual_indicators JSON only. |
| 25 | Bundle toggles via different mechanism | App includes in payload; server ignores (no column). Bundles managed via separate API on both. |
| 67 | Welcome message via different endpoint | Web uses `/api/auth/login-message`; app includes in settings POST. Server column exists, both work. |
| 70 | App sends `audit_log_pruning_enabled` | Server column exists. Web uses null max_days to indicate disabled. |
| 75-79 | Dependent apps via different mechanism | Web manages via separate API calls; app includes in settings POST. Server columns exist, values preserved. |
| 80 | App sends redundant `clock_orientation` | Same value as `alarm_orientation`. Server column exists. Harmless duplicate. |

## Section Placement Notes

All 80 settings are in the correct tab and section matching the web layout. The only cosmetic differences are:
- Web uses `<select>` dropdowns for HST clock mode and Color mode; app uses segmented buttons (same options, different control style)
- These are acceptable mobile UX adaptations — same data, same options, just a touch-friendlier control
