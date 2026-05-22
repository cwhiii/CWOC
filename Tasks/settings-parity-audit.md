# Settings Parity Audit: Web vs Android App — Complete

Every persistent setting from `settings.html` + `settings.js` (web) compared against the Android app.

**Placement?**: ✅ = same tab & section as web, ❌ = missing from app, 🔀 = wrong tab/section
**Display?**: ✅ = same control type & options, ⚠️ = minor difference, ❌ = wrong options or control type

| # | Web Tab | Web Box | Setting | Server Key | Web Sends | App Sends | App Tab | App Section | Match? | Placement? | Display? |
|---|---------|---------|---------|-----------|-----------|-----------|---------|-------------|--------|-----------|----------|
| 1 | General | General Settings | Sex | `sex` | `"Man"`/`"Woman"` | `"Man"`/`"Woman"` | General | (top) | ✅ | ✅ | ✅ Pill toggle, same 2 options |
| 2 | General | General Settings | Units | `unit_system` | `"imperial"`/`"metric"` | `"imperial"`/`"metric"` | General | (top) | ✅ | ✅ | ✅ Pill toggle, same 2 options |
| 3 | General | General Settings | Snooze Length | `snooze_length` | `"1 minute"`/`"3 minutes"`/`"5 minutes"`/`"10 minutes"` | Same | General | (top) | ✅ | ✅ | ✅ Dropdown, same 4 options |
| 4 | General | General Settings | Calendar Snap | `calendar_snap` | `"0"`/`"5"`/`"10"`/`"15"`/`"20"`/`"25"`/`"30"`/`"60"` | Same | General | (top) | ✅ | ✅ | ✅ Dropdown, same 8 options |
| 5 | General | General Settings | Default share contacts | `default_share_contacts` | `"1"`/`"0"` | `"1"`/`"0"` | General | Contact Vault | ✅ | ✅ | ✅ Toggle/switch |
| 6 | General | General Settings | Time Format | `time_format` | `"24hour"`/`"12hour"`/`"metric"` | Same | General | (top) | ✅ | ✅ | ✅ Dropdown, same 3 options |
| 7 | General | General Settings | Clock Orientation | `alarm_orientation` | `"Vertical"`/`"Horizontal"` | Same | General | Clocks | ✅ | ✅ | ✅ Toggle button |
| 8 | General | General Settings | Active Clocks | `active_clocks` | JSON array | JSON array | General | Clocks | ✅ | ✅ | ✅ Drag-drop grid |
| 9 | General | General Settings | Default Timezone | `default_timezone` | IANA string | IANA string | General | (top) | ✅ | ✅ | ✅ Searchable text input |
| 10 | General | General Settings | Timezone Override | `timezone_override` | IANA string/null | IANA string/"" | General | (top) | ✅ | ✅ | ✅ Searchable text input + clear button |
| 11 | General | Display Options | Landing View | `default_view` | `"Omni"`/`"Calendar"`/`"Checklists"`/`"Alarms"`/`"Projects"`/`"Tasks"`/`"Notes"`/`"Email"`/`"Indicators"` | Missing Omni, Email, Indicators | General | Display Options | ✅ | ✅ | ❌ App only has 6 options, web has 9. Missing: Omni, Email, Indicators |
| 12 | General | Display Options | View Order | `view_order` | JSON array | JSON array | General | Display Options | ✅ | ✅ | ✅ Drag-reorder modal |
| 13 | General | Display Options | Hidden Views | `hidden_views` | Not sent | JSON array | General | Display Options | ⚠️ | ✅ | ✅ Part of view order drag |
| 14 | General | Display Options | Chit Options | `chit_options` | JSON object (6 booleans) | Same | General | Chit Options | ✅ | ✅ | ✅ Checkboxes, same 6 options |
| 15 | General | Display Options | Checklist Autosave | `checklist_autosave` | `"1"`/`"0"` | `"1"`/`"0"` | General | Chit Options | ✅ | ✅ | ✅ Checkbox |
| 16 | General | Display Options | Autosave Desktop | `autosave_desktop` | `"1"`/`"0"` | `"1"`/`"0"` | General | Chit Options | ✅ | ✅ | ✅ Checkbox |
| 17 | General | Display Options | Autosave Mobile | `autosave_mobile` | `"1"`/`"0"` | `"1"`/`"0"` | General | Chit Options | ✅ | ✅ | ✅ Checkbox |
| 18 | General | Display Options | Show Map Thumbnails | `show_map_thumbnails` | `"1"`/`"0"` | `"1"`/`"0"` | General | Chit Options | ✅ | ✅ | ✅ Checkbox |
| 19 | General | Display Options | Hide Declined | `hide_declined` | `"1"`/`"0"` | `"1"`/`"0"` | General | Chit Options | ✅ | ✅ | ✅ Checkbox |
| 20 | General | Display Options | Visual Indicators | `visual_indicators` | JSON (9 indicators + combine_alerts) | Same | General | Visual Indicators | ✅ | ✅ | ✅ Dropdowns (always/never/space) per indicator + combine checkbox |
| 21 | General | Display Options | Combine Alerts | `combine_alerts` | Not sent separately | `"0"`/`"1"` | General | Visual Indicators | ⚠️ | ✅ | ✅ Checkbox |
| 22 | General | Custom Filters | Custom View Filters | `custom_view_filters` | JSON object | JSON object | General | Custom Filters | ✅ | ✅ | ✅ Per-view filter modal |
| 23 | Views | Omni View | HST Bar Clock | `omni_hst_clock_mode` | `"both"`/`"hst"`/`"system"` | Same | Views | Omni View | ✅ | ✅ | ⚠️ Web=dropdown, App=segmented button. Same 3 options. |
| 24 | Views | Omni View | Omni Layout | `omni_layout` | JSON object | JSON object | Views | Omni View | ✅ | ✅ | ✅ Drag-reorder modal |
| 25 | Views | Omni View | Bundle Toggles | `omni_bundle_toggles` | Separate API | JSON object | Views | Omni View | ⚠️ | ✅ | ✅ Checkbox list per bundle |
| 26 | Views | Omni View | Emails to show | `omni_email_count` | `"3"`/`"5"`/`"10"`/`"15"`/`"20"` | Same | Views | Omni View | ✅ | ✅ | ✅ Dropdown, same 5 options |
| 27 | Views | Omni View | Color mode | `omni_normalize_colors` | `"colored"`/`"normalized"`/`"mono"` | Same | Views | Omni View | ✅ | ✅ | ⚠️ Web=dropdown, App=segmented button. Same 3 options. |
| 28 | Views | Omni View | Locked Filters | `omni_locked_filters` | JSON/undefined | JSON/`"[]"` | Views | Omni View | ✅ | ✅ | ✅ Display + Clear button |
| 29 | Views | Calendar | Week Starts On | `week_start_day` | `"0"`–`"6"` | `"0"`–`"6"` | Views | Calendar | ✅ | ✅ | ✅ Dropdown, all 7 days |
| 30 | Views | Calendar | View Hours Start | `all_view_start_hour` | `"0"`–`"23"` | `"0"`–`"23"` | Views | Calendar | ✅ | ✅ | ✅ Hour dropdown 0–23 |
| 31 | Views | Calendar | View Hours End | `all_view_end_hour` | `"0"`–`"24"` | `"0"`–`"23"` | Views | Calendar | ⚠️ | ✅ | ⚠️ Web goes to 24 (midnight), app stops at 23 |
| 32 | Views | Calendar | Scroll to Hour | `day_scroll_to_hour` | `"0"`–`"12"` | `"0"`–`"12"` | Views | Calendar | ✅ | ✅ | ✅ Hour dropdown 0–12 |
| 33 | Views | Calendar | Enabled Periods | `enabled_periods` | Comma-joined names | Same | Views | Calendar | ✅ | ✅ | ✅ Checkboxes: Itinerary, Day, Week, Month, Year, SevenDay, Work |
| 34 | Views | Calendar | X Days Count | `custom_days_count` | `"2"`–`"30"` | `"2"`–`"30"` | Views | Calendar | ✅ | ✅ | ✅ Number input min=2 max=30 |
| 35 | Views | Calendar | Work Days | `work_days` | `"0,1,2,3,4,5,6"` | Same | Views | Calendar | ✅ | ✅ | ✅ 7 day checkboxes (Sun–Sat) |
| 36 | Views | Calendar | Work Hours Start | `work_start_hour` | `"0"`–`"23"` | `"0"`–`"23"` | Views | Calendar | ✅ | ✅ | ✅ Hour dropdown 0–23 |
| 37 | Views | Calendar | Work Hours End | `work_end_hour` | `"0"`–`"23"` | `"0"`–`"23"` | Views | Calendar | ✅ | ✅ | ✅ Hour dropdown 0–23 |
| 38 | Views | Habits | Success Window | `habits_success_window` | `"7"`/`"30"`/`"90"`/`"all"` | Same | Views | Habits | ✅ | ✅ | ✅ Dropdown, same 4 options |
| 39 | Views | Habits | Show habits on calendar | `default_show_habits_on_calendar` | `"1"`/`"0"` | `"1"`/`"0"` | Views | Habits | ✅ | ✅ | ✅ Checkbox |
| 40 | Views | Projects | Show child count | `projects_show_child_count` | `"1"`/`"0"` | `"1"`/`"0"` | Views | Projects | ✅ | ✅ | ✅ Checkbox |
| 41 | Views | Projects | Show checklist count | `projects_show_checklist_count` | `"1"`/`"0"` | `"1"`/`"0"` | Views | Projects | ✅ | ✅ | ✅ Checkbox |
| 42 | Views | Maps | Auto-zoom | `map_auto_zoom` | `"1"`/`"0"` | `"1"`/`"0"` | Views | Maps | ✅ | ✅ | ✅ Checkbox |
| 43 | Views | Maps | Default Latitude | `map_default_lat` | Decimal/null | Decimal/null | Views | Maps | ✅ | ✅ | ✅ Number input |
| 44 | Views | Maps | Default Longitude | `map_default_lon` | Decimal/null | Decimal/null | Views | Maps | ✅ | ✅ | ✅ Number input |
| 45 | Views | Maps | Default Zoom | `map_default_zoom` | Integer/null | Integer/null | Views | Maps | ✅ | ✅ | ✅ Number input 1–18 |
| 46 | Collections | Tag Editor | Tags | `tags` | JSON array | JSON array | Collections | Tag Editor | ✅ | ✅ | ✅ Tag tree with add/edit/delete/color/favorite |
| 47 | Collections | Custom Colors | Custom Colors | `custom_colors` | Array of hex | JSON array | Collections | Custom Colors | ✅ | ✅ | ✅ Color swatches with add/remove |
| 48 | Collections | Custom Colors | Overdue Border Color | `overdue_border_color` | Hex string | Hex/null | Collections | Custom Colors | ✅ | ✅ | ✅ Color assignment |
| 49 | Collections | Custom Colors | Blocked Border Color | `blocked_border_color` | Hex string | Hex/null | Collections | Custom Colors | ✅ | ✅ | ✅ Color assignment |
| 50 | Collections | Saved Locations | Saved Locations | `saved_locations` | JSON array | JSON array | Collections | Saved Locations | ✅ | ✅ | ✅ Location rows with label/address/default |
| 51 | Collections | Default Notifications | Default Notifications | `default_notifications` | JSON object | JSON object | Collections | Default Notifications | ✅ | ✅ | ✅ Start/Due notification rows |
| 52 | Email | Accounts & Syncing | Email Accounts | `email_accounts` | JSON array | JSON array | Email | Accounts | ✅ | ✅ | ✅ Account list with add/edit/delete |
| 53 | Email | Accounts & Syncing | Max Pull | `email_max_pull` | Integer string | Integer string | Email | Syncing | ✅ | ✅ | ✅ Number input 1–1000 |
| 54 | Email | Accounts & Syncing | Check Interval | `email_check_interval` | `"manual"`/`"5"`/`"15"`/`"30"`/`"60"` | Same | Email | Syncing | ✅ | ✅ | ✅ Dropdown, same 5 options |
| 55 | Email | Privacy & Sending | Block Tracking | `email_block_tracking_pixels` | `"1"`/`"0"` | `"1"`/`"0"` | Email | Privacy | ✅ | ✅ | ✅ Checkbox |
| 56 | Email | Privacy & Sending | External Content | `email_external_content` | `"allow"`/`"block"`/`"known_senders"` | Same | Email | Privacy | ✅ | ✅ | ✅ Dropdown, same 3 options |
| 57 | Email | Privacy & Sending | Read Receipts | `email_read_receipts` | `"never"`/`"always"`/`"ask"`/`"contacts_only"` | Same | Email | Privacy | ✅ | ✅ | ✅ Dropdown, same 4 options |
| 58 | Email | Privacy & Sending | Undo Send Delay | `email_undo_send_delay` | `"5"`/`"10"`/`"15"`/`"30"` | Same | Email | Privacy | ✅ | ✅ | ✅ Dropdown, same 4 options |
| 59 | Email | Privacy & Sending | Signature | `email_signature` | Markdown string | Markdown string | Email | Signature | ✅ | ✅ | ✅ Text editor |
| 60 | Email | Display & Bundles | Group By | `email_group_by` | `"date"`/`"none"` | Same | Email | Display | ✅ | ✅ | ✅ Dropdown, same 2 options |
| 61 | Email | Display & Bundles | Paginate | `paginate_email` | `"1"`/`"0"` | `"1"`/`"0"` | Email | Display | ✅ | ✅ | ✅ Checkbox |
| 62 | Email | Display & Bundles | Bundles Enabled | `bundles_enabled` | `"1"`/`"0"` | `"1"`/`"0"` | Email | Bundles | ✅ | ✅ | ✅ Checkbox |
| 63 | Email | Display & Bundles | Multi-Placement | `bundles_multi_placement` | `"1"`/`"0"` | `"1"`/`"0"` | Email | Bundles | ✅ | ✅ | ✅ Checkbox |
| 64 | Email | Display & Bundles | Bundle Count | `bundles_show_count` | `"both"`/`"unread"`/`"total"`/`"none"` | Same | Email | Bundles | ✅ | ✅ | ✅ Dropdown, same 4 options |
| 65 | Email | Badges | Badge Detectors | `badge_detectors` | JSON array | JSON array | Email | Badges | ✅ | ✅ | ✅ Category toggles + custom detector modal |
| 66 | Admin | Admin | Instance Name | `instance_name` | Free text | Free text | Administration | Admin | ✅ | ✅ | ✅ Text input |
| 67 | Admin | Admin | Welcome Message | `welcome_message` | Separate endpoint | In payload | Administration | Admin | ⚠️ | ✅ | ✅ Textarea with markdown preview |
| 68 | Admin | Admin | Session Lifetime | `session_lifetime` | `"1"`/`"12"`/`"24"`/`"168"`/`"720"`/`"0"` | `"1"`/`"12"`/`"24"`/`"168"`/`"720"`/`"never"` | Administration | Admin | ❌ | ✅ | ❌ App sends "never" for Never, web sends "0" |
| 69 | Admin | Tools | Kiosk Tags | `kiosk_selected_tags` | JSON (as `kiosk_users`) | JSON array | Administration | Kiosk | ⚠️ | ✅ | ✅ Tag checkbox list |
| 70 | Admin | Data Management | Audit Pruning Enabled | `audit_log_pruning_enabled` | Not sent | `"0"`/`"1"` | Administration | Data Management | ⚠️ | ✅ | ✅ Checkbox |
| 71 | Admin | Data Management | Audit Max Days | `audit_log_max_days` | Integer/null | String | Administration | Data Management | ⚠️ | ✅ | ✅ Number input |
| 72 | Admin | Data Management | Audit Max MB | `audit_log_max_mb` | Integer/null | String | Administration | Data Management | ⚠️ | ✅ | ✅ Number input |
| 73 | Admin | Data Management | Attachment Max Size | `attachment_max_size_mb` | `"5"`/`"10"`/`"25"`/`"50"` | Same | Administration | Data Management | ✅ | ✅ | ✅ Dropdown, same 4 options |
| 74 | Admin | Data Management | Attachment Max Storage | `attachment_max_storage_mb` | `"100"`/`"250"`/`"500"`/`"1024"`/`"2048"`/`"5120"`/`"0"` | Same | Administration | Data Management | ✅ | ✅ | ✅ Dropdown, same 7 options |
| 75 | Admin | Dependent Apps | Tailscale Enabled | `tailscale_enabled` | Separate API | `"0"`/`"1"` | Administration | Dependent Apps | ⚠️ | ✅ | ✅ Toggle button |
| 76 | Admin | Dependent Apps | Tailscale Auth Key | `tailscale_auth_key` | Separate API | String/null | Administration | Dependent Apps | ⚠️ | ✅ | ✅ Password input + show/hide |
| 77 | Admin | Dependent Apps | Ntfy Enabled | `ntfy_enabled` | Separate API | `"0"`/`"1"` | Administration | Dependent Apps | ⚠️ | ✅ | ✅ Toggle button |
| 78 | Admin | Dependent Apps | HA Enabled | `ha_enabled` | Separate API | `"0"`/`"1"` | Administration | Dependent Apps | ⚠️ | ✅ | ✅ Toggle button |
| 79 | Admin | Dependent Apps | HA Poll Interval | `ha_poll_interval` | Separate API | `"30"` | Administration | Dependent Apps | ⚠️ | ✅ | ✅ Number input |
| 80 | — | — | Clock Orientation (dup) | `clock_orientation` | Not sent | `"Horizontal"`/`"Vertical"` | General | Clocks | ⚠️ | N/A | N/A |

---

## Display Mismatches That Need Fixing

| # | Setting | Issue | Severity |
|---|---------|-------|----------|
| 11 | Landing View | App dropdown missing "Omni", "Email", "Indicators" options. Web has 9 options, app has 6. | HIGH — user can't select these views as landing |
| 31 | View Hours End | Web allows "24" (midnight end), app stops at "23" | LOW — edge case |
| 68 | Session Lifetime | App sends `"never"` for Never option, web sends `"0"`. Different stored value. | HIGH — cross-platform mismatch on save |
