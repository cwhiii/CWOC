# Settings Page — Android Parity Checklist

Complete audit of every input, toggle, button, and text element on the web Settings page vs the Android app.

**Legend:**
- ✅ = Present and fully functional in Android
- ⚠️ = Present but incomplete/different behavior
- ❌ = Missing from Android entirely
- 🔲 = Placeholder only (TODO in code, no functional UI)
- N/A = Not applicable to mobile (platform-specific)

---

## Tab Structure

| # | Web Tab | Android Tab | Status |
|---|---------|-------------|--------|
| 1 | ⚙️ General | General | ✅ |
| 2 | 👁️ Views | Views | ✅ |
| 3 | 📦 Collections | Collections | ✅ |
| 4 | ✉️ Email | Email | ✅ |
| 5 | — (Badges in Email tab on web) | Badges (separate tab) | ⚠️ Split differently |
| 6 | 🔒 Administration (admin only) | Admin | ✅ |

---

## GENERAL TAB

### ⚙️ General Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 1 | Sex (Man/Woman pill toggle) | 2-val toggle | ✅ | Android uses "Male/Female" instead of "♂ Man / ♀ Woman" — labels differ |
| 2 | 📏 Units (Imperial/Metric pill toggle) | 2-val toggle | ✅ | |
| 3 | ⏱️ Snooze Length (1/3/5/10 min) | select | ⚠️ | Web has 1/3/5/10 min; Android has 5/10/15/30/60 min — options mismatch |
| 4 | 📐 Calendar Snap (None/5/10/15/20/25/30/60 min) | select | ⚠️ | Web has None+8 options; Android missing "None", "20 min", "25 min" |

### 🏛️ Contact Vault Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 5 | Default share new contacts (checkbox+switch) | toggle | ❌ | Missing entirely |
| 6 | Hint text explaining sharing | text | ❌ | |

### 🕐 Clocks Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 7 | 🕰️ Time Format (24 Hour/12 Hour/HST) | select | ⚠️ | Android only has 12h/24h toggle; missing "HST" (metric time) option |
| 8 | 🔄 Orientation button (toggle clock layout) | button | ❌ | Missing |
| 9 | Active Clocks grid (drag-drop reorder) | drag grid | ❌ | Missing — only placeholder text |
| 10 | Inactive Clocks zone (drag to deactivate) | drag zone | ❌ | Missing |
| 11 | Add Clock button | button | ❌ | Missing |

### 🌐 Timezone Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 12 | Default Timezone (text input + datalist) | text+autocomplete | ✅ | Searchable dropdown works |
| 13 | Current Override (text input + datalist) | text+autocomplete | ❌ | Missing — no timezone override |
| 14 | ✕ Clear Override button | button | ❌ | Missing |


### 🎯 Display Options Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 15 | Landing view dropdown (Omni/Calendar/Checklists/Alerts/Projects/Tasks/Notes/Email/Indicators) | select | ⚠️ | Android missing Omni, Email, Indicators options |
| 16 | 📋 Arrange Views button (opens modal) | button | ✅ | Has ArrangeViewsDialog |
| 17 | Arrange Views modal (drag reorder + hidden zone) | modal | ⚠️ | Android has up/down buttons, no hidden zone for hiding views |
| 18 | 🔄 Reset All Sort Orders button | button | ❌ | Missing |

### Chit Options (checkboxes)

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 19 | ⚡ Checklist Auto-Save | checkbox | ❌ | Missing |
| 20 | 💾 Auto-save on Desktop | checkbox | ❌ | Missing |
| 21 | 💾 Auto-save on Mobile | checkbox | ❌ | Missing |
| 22 | 📜 Fade Past Chits | checkbox | ❌ | Missing |
| 23 | 🚨 Highlight Overdue | checkbox | ❌ | Missing |
| 24 | 🚧 Highlight Blocked | checkbox | ❌ | Missing |
| 25 | 🗑️ Delete Past Alarms | checkbox | ❌ | Missing |
| 26 | 🔢 Show Tab Counts | checkbox | ❌ | Missing |
| 27 | 🗺️ Prefer Google for Maps | checkbox | ❌ | Missing |
| 28 | 📍 Show Map Thumbnails | checkbox | ❌ | Missing |
| 29 | 🚫 Hide declined chits | checkbox | ❌ | Missing |

### Visual Indicators Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 30 | Combine Alerts checkbox | checkbox | ❌ | Missing |
| 31 | 🔔 Alarm indicator (Always/Never/If Space) | select | ❌ | Missing |
| 32 | 📢 Notification indicator | select | ❌ | Missing |
| 33 | ⏱️ Timer indicator | select | ❌ | Missing |
| 34 | ⏲️ Stopwatch indicator | select | ❌ | Missing |
| 35 | Combined Alerts indicator (conditional) | select | ❌ | Missing |
| 36 | 🌤️ Weather indicator | select | ❌ | Missing |
| 37 | 👥 People indicator | select | ❌ | Missing |
| 38 | ❤️ Indicators indicator | select | ❌ | Missing |
| 39 | 📊 Custom Data indicator | select | ❌ | Missing |


### Custom Filters & Sorting Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 40 | Per-view custom filter buttons (opens filter modal) | button list | ❌ | Missing entirely |
| 41 | Custom filter modal (multi-select filters per view) | modal | ❌ | Missing |

### 📱 Install as App Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 42 | 📲 Install CWOC App button | button | N/A | Not applicable — already a native app |
| 43 | 🌐 Open in Chrome to Install button | button | N/A | |
| 44 | 📜 Download Server Certificate button | button | N/A | |
| 45 | 🔔 Test Phone Notification button | button | ❌ | Could be useful for testing ntfy on mobile |

---

## VIEWS TAB

### 🔮 Omni View Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 46 | 🕐 HST Bar Clock mode (Both/HST Only/System Only) | select | ❌ | Missing |
| 47 | 🔮 Arrange Omni Layout button (opens modal) | button | ❌ | Missing |
| 48 | Omni Layout modal (drag cards between columns) | modal | ❌ | Missing |
| 49 | Bundle Omni View Toggles (checkboxes per bundle) | checkbox list | ❌ | Missing |
| 50 | 📧 Emails to show (3/5/10/15/20) | select | ❌ | Missing |
| 51 | 🎨 Color mode (Colored/Normalized/Mono) | select | ❌ | Missing |
| 52 | 🔒 Locked Filter Defaults display | text | ❌ | Missing |
| 53 | 🗑️ Clear Defaults button | button | ❌ | Missing |
| 54 | ↩️ Reset Omni View to Defaults button | button | ❌ | Missing |

### 📅 Calendar Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 55 | Week Starts On (Sun-Sat dropdown) | select | ⚠️ | Android only has Sun/Mon/Sat; web has all 7 days |
| 56 | 🕐 View Hours start/end (hour range dropdowns) | 2x select | ❌ | Missing |
| 57 | 📍 Scroll to hour (0-12 dropdown) | select | ❌ | Missing |
| 58 | Enabled Periods: Itinerary checkbox | checkbox | ✅ | |
| 59 | Enabled Periods: Day checkbox | checkbox | ✅ | |
| 60 | Enabled Periods: Week checkbox | checkbox | ✅ | |
| 61 | Enabled Periods: Month checkbox | checkbox | ✅ | |
| 62 | Enabled Periods: Year checkbox | checkbox | ✅ | |
| 63 | Enabled Periods: X Days checkbox | checkbox | ✅ | Called "X-Day" in Android |
| 64 | X Days Count (number input, 2-30) | number input | ❌ | Missing |
| 65 | Work Hours checkbox (enables work config) | checkbox | ❌ | Missing |
| 66 | Work Days checkboxes (Sun-Sat) | 7x checkbox | ❌ | Missing |
| 67 | Work Hours start/end (hour range dropdowns) | 2x select | ❌ | Missing |


### 🔁 Habits Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 68 | 📊 Success rate window (7/30/90 days/All time) | select | ❌ | Missing (only placeholder in General tab) |
| 69 | 📅 Default: show habits on calendar | checkbox | ❌ | Missing |

### 📂 Projects Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 70 | Show child chit count on project masters | checkbox | ❌ | Missing |
| 71 | Show aggregate checklist progress on project masters | checkbox | ❌ | Missing |

### 🗺️ Maps Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 72 | Auto-zoom to markers on load | checkbox | ❌ | Missing |
| 73 | Default Latitude (number input) | number input | ❌ | Missing |
| 74 | Default Longitude (number input) | number input | ❌ | Missing |
| 75 | Default Zoom 1-18 (number input) | number input | ❌ | Missing |

---

## COLLECTIONS TAB

### 🏷️ Tag Editor Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 76 | New tag name text input | text input | ✅ | In Add Tag dialog |
| 77 | ➕ Add button | button | ✅ | |
| 78 | Tag tree display (hierarchical, colored) | tree view | ⚠️ | Flat list, not hierarchical tree |
| 79 | Tag modal: ☆ Favorite star toggle | toggle | ❌ | Missing from tag edit dialog |
| 80 | Tag modal: Tag name input | text input | ✅ | |
| 81 | Tag modal: 🔗 Sharing section | section | ❌ | Missing — no tag sharing UI |
| 82 | Tag modal: Share user picker dropdown | select | ❌ | Missing |
| 83 | Tag modal: Share role select (Viewer/Manager) | select | ❌ | Missing |
| 84 | Tag modal: ➕ Share button | button | ❌ | Missing |
| 85 | Tag modal: Background Color picker | color input | ⚠️ | Android has preset swatches only, no free color picker |
| 86 | Tag modal: Background color swatches | swatches | ✅ | |
| 87 | Tag modal: Font Color picker | color input | ❌ | Missing — no font color support |
| 88 | Tag modal: Font color swatches | swatches | ❌ | Missing |
| 89 | Tag modal: Preview chip | preview | ❌ | Missing |
| 90 | Tag modal: Done button | button | ✅ | "Save" in Android |
| 91 | Tag modal: Cancel button | button | ✅ | |
| 92 | Tag modal: Delete button | button | ✅ | Via long-press + confirm dialog |


### 🎨 Custom Colors Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 93 | Default Colors display (non-editable swatches) | display | ✅ | |
| 94 | Custom Colors display (editable swatches) | display | ✅ | |
| 95 | ➕ Add Color button (opens native color picker) | button | ✅ | Opens hex input dialog instead of native picker |
| 96 | Color swatch delete button (×) | button | ✅ | Via edit dialog |
| 97 | Border color assignment (Overdue/Blocked ring) | popup | ❌ | Missing — no border color assignment |
| 98 | Overdue border color indicator ring | display | ❌ | Missing |
| 99 | Blocked border color indicator ring | display | ❌ | Missing |

### 📍 Saved Locations Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 100 | Location rows (radio + label input + address input + remove) | row list | ✅ | |
| 101 | Radio button for default location | radio | ✅ | |
| 102 | Location label input (editable inline) | text input | ✅ | In edit dialog |
| 103 | Location address input (editable inline) | text input | ✅ | In edit dialog |
| 104 | Remove location button | button | ✅ | |
| 105 | ➕ Add Location button | button | ✅ | |

### 🔔 Default Notifications Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 106 | 📅 Start Time Notifications list | list | ✅ | |
| 107 | Start notification ➕ Add button | button | ✅ | |
| 108 | ⏰ Due Time Notifications list | list | ✅ | |
| 109 | Due notification ➕ Add button | button | ✅ | |
| 110 | Notification offset dropdown (5/10/15/30/60/120/1440/2880/10080 min) | select | ✅ | |
| 111 | Remove notification rule button | button | ✅ | |

---

## EMAIL TAB

### 📧 Accounts & Syncing Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 112 | Account summary display | text | ✅ | Shows in card list |
| 113 | 📧 Manage Email Accounts button (opens modal) | button | ⚠️ | Android shows inline, web uses modal |
| 114 | Account modal: list view with account cards | list | ✅ | |
| 115 | Account modal: ➕ Add Account button | button | ✅ | |
| 116 | Account edit: Nickname field | text input | ✅ | |
| 117 | Account edit: Email Address field | text input | ✅ | |
| 118 | Account edit: IMAP Host field | text input | ✅ | |
| 119 | Account edit: IMAP Port field | text input | ✅ | |
| 120 | Account edit: SMTP Host field | text input | ✅ | |
| 121 | Account edit: SMTP Port field | text input | ✅ | |
| 122 | Account edit: Username field | text input | ✅ | |
| 123 | Account edit: Password field (masked) | password | ✅ | |
| 124 | Account edit: ✅ Done button | button | ✅ | "Save" |
| 125 | Account edit: 🗑️ Delete button | button | ✅ | |
| 126 | Account: Test Connection button | button | ❌ | Missing |


### 🔄 Syncing Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 127 | Max Pull (number input, 1-1000) | number input | ⚠️ | Android uses dropdown (50/100/200/500/1000) instead of free input |
| 128 | Check Mail interval (Manual/5/15/30/60 min) | select | ⚠️ | Android has 5/10/15/30/60 — missing "Manual only" option |
| 129 | 📥 Backfill button | button | ⚠️ | Android has toggle switch, web has action button |

### 🛡️ Privacy & Sending Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 130 | Block Tracking Pixels (checkbox) | checkbox | ✅ | Switch in Android |
| 131 | External Content (Allow all/Block all/Allow from contacts) | select | ⚠️ | Android has Always/Ask/Never — different options |
| 132 | Read Receipts (Never/Always/Ask/Contacts only) | select | ⚠️ | Android has simple toggle, web has 4 options |
| 133 | Undo Send Delay (5/10/15/30 sec) | select | ✅ | |
| 134 | ✍️ Signature inline preview | display | ❌ | Missing — Android has plain text field |
| 135 | ✏️ Edit Signature button (opens modal) | button | ❌ | Missing — Android edits inline |
| 136 | Signature modal (Markdown editor) | modal | ❌ | Missing — no Markdown support |
| 137 | 📎 Attachments hint text | text | ❌ | Missing |
| 138 | 📎 View All Attachments button | button | ❌ | Missing |

### 📄 Display & Bundles Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 139 | Group Emails By (Date/None) | select | ⚠️ | Android has Thread/None — different options |
| 140 | Paginate Emails (checkbox + "Load More") | checkbox | ✅ | Switch in Android |
| 141 | 📦 Enable Email Bundles | checkbox | ✅ | Switch |
| 142 | Allow Multi-Placement | checkbox | ✅ | Switch |
| 143 | Bundle Count Display (Both/Unread/Total/Hidden) | select | ⚠️ | Android has simple toggle, web has 4 options |
| 144 | 🤖 Auto-Bundles toggle list (per built-in bundle) | checkbox list | ⚠️ | Android has custom rule add, web has per-bundle toggles |

### 🛡️ Badges Section (on web: inside Email tab)

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 145 | Max badges per email (1/2/3/5/10) | select | ✅ | |
| 146 | Detector category toggles (built-in) | toggle list | ✅ | |
| 147 | Individual detector on/off toggles | toggle | ✅ | |
| 148 | Custom Detectors list | list | ✅ | |
| 149 | + Add Custom Detector button | button | ✅ | |
| 150 | Custom Detector modal: Name | text input | ✅ | |
| 151 | Custom Detector modal: Category dropdown | select | ❌ | Missing — Android has no category field |
| 152 | Custom Detector modal: Keywords | text input | ❌ | Missing — Android uses regex only |
| 153 | Custom Detector modal: Regex Pattern | text input | ✅ | |
| 154 | Custom Detector modal: URL Template | text input | ❌ | Missing |
| 155 | Custom Detector modal: Button Label dropdown | select | ❌ | Missing |
| 156 | Custom Detector modal: Icon (emoji) | text input | ✅ | |


---

## ADMINISTRATION TAB

### Admin Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 157 | 👥 Manage Users button | button | ❌ | Missing |
| 158 | 🔧 Chit Manager button | button | ✅ | |
| 159 | Instance Name text input | text input | ❌ | Missing |
| 160 | Welcome Message textarea (Markdown) | textarea | ❌ | Missing |
| 161 | Welcome Message preview | display | ❌ | Missing |
| 162 | 🔑 Session Lifetime dropdown (1h/12h/24h/1w/1mo/Never) | select | ❌ | Missing |

### 🛠️ Tools Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 163 | 📺 Kiosk tag selection list | checkbox list | ❌ | Missing |
| 164 | 📺 Open Kiosk button | button | ❌ | Missing |

### 📦 Data Management Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 165 | 🌐 Export All button | button | ✅ | |
| 166 | 📥 Import All button | button | ✅ | "Import Data" |
| 167 | Chit Data Export button | button | ❌ | Missing — web has separate chit/user exports |
| 168 | Chit Data Import button | button | ❌ | Missing |
| 169 | User Data Export button | button | ❌ | Missing |
| 170 | User Data Import button | button | ❌ | Missing |
| 171 | 📅 Calendar Import (.ics) button | button | ❌ | Missing |
| 172 | ICS import: Import as user dropdown | select | ❌ | Missing |
| 173 | ✅ Import Google Tasks (.json) button | button | ❌ | Missing |
| 174 | 📝 Import Google Keep (.json) button | button | ❌ | Missing |
| 175 | 📦 Import Batches list (delete batch) | list | ❌ | Missing |
| 176 | 📋 Audit Log button (navigate) | button | ❌ | Missing from settings (may be elsewhere) |
| 177 | 🗑️ Trash button (navigate) | button | ❌ | Missing from settings (may be elsewhere) |
| 178 | 🧩 Custom Objects button (navigate) | button | ❌ | Missing from settings |
| 179 | 📜 Audit Log Limits: Enable Pruning checkbox | checkbox | ❌ | Missing |
| 180 | Audit Max Age (days) number input | number input | ❌ | Missing |
| 181 | Audit Max Size (MB) number input | number input | ❌ | Missing |
| 182 | 📎 Attachment Max File Size (5/10/25/50 MB) | select | ⚠️ | In email tab on Android |
| 183 | 📎 Attachment Max Storage Per User | select | ❌ | Missing |
| 184 | Import Mode modal (Add/Replace choice) | modal | ❌ | Missing |
| 185 | Replace Confirmation modal | modal | ✅ | |
| 186 | Replace All Data button | button | ✅ | |
| 187 | Purge All Data button (2-step confirm) | button | ✅ | |


### 📱 Dependent Apps Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 188 | Tailscale enable/disable button | toggle button | ⚠️ | Android shows status text only, no enable/disable |
| 189 | Tailscale help text (expandable) | text | ❌ | Missing |
| 190 | Tailscale Status display | text | ✅ | |
| 191 | Tailscale IP display | text | ❌ | Missing |
| 192 | Tailscale Hostname display | text | ❌ | Missing |
| 193 | Tailscale Auth Key input (password) | password | ❌ | Missing |
| 194 | Tailscale 👁️ Show/hide key button | button | ❌ | Missing |
| 195 | Tailscale 🔑 Get Key link | link | ❌ | Missing |
| 196 | Tailscale 💾 Save Config button | button | ❌ | Missing |
| 197 | Tailscale ▶️ Connect / ⏹️ Disconnect button | button | ❌ | Missing |
| 198 | Tailscale 🔄 Check Status button | button | ❌ | Missing |
| 199 | Ntfy enable/disable button | toggle button | ❌ | Missing — Android shows fields directly |
| 200 | Ntfy help text (expandable) | text | ❌ | Missing |
| 201 | Ntfy Server URL display (local) | text | ❌ | Missing |
| 202 | Ntfy Server URL display (Tailscale) | text | ❌ | Missing |
| 203 | Ntfy Topic display | text | ❌ | Missing |
| 204 | Ntfy Server URL input | text input | ✅ | |
| 205 | Ntfy Topic input | text input | ✅ | |
| 206 | Ntfy 💾 Save Config button | button | ❌ | Missing (saves with global save) |
| 207 | Ntfy 🔔 Test Notification button | button | ✅ | |
| 208 | Home Assistant enable/disable button | toggle button | ❌ | Missing |
| 209 | Home Assistant help text (expandable) | text | ❌ | Missing |
| 210 | HA Base URL input | text input | ✅ | |
| 211 | HA Access Token input (password) | password | ✅ | |
| 212 | HA 👁️ Show/hide token button | button | ❌ | Missing |
| 213 | HA Poll Interval (number, 5-3600 sec) | number input | ❌ | Missing |
| 214 | HA 🔌 Test Connection button | button | ✅ | |
| 215 | HA 💾 Save HA Config button | button | ❌ | Missing (saves with global save) |
| 216 | HA Webhook URL display (readonly) | text | ❌ | Missing |
| 217 | HA 📋 Copy Webhook URL button | button | ❌ | Missing |
| 218 | HA 🔄 Regenerate Webhook Secret button | button | ❌ | Missing |

### 🔄 Version & Updates Section

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 219 | Version display | text | ✅ | |
| 220 | Updated date display | text | ❌ | Missing |
| 221 | Disk usage display + 🔄 refresh button | text+button | ❌ | Missing |
| 222 | CWOC Data size display | text | ❌ | Missing |
| 223 | ⬆️ Upgrade button | button | ❌ | Missing |
| 224 | 📄 Show Log button | button | ❌ | Missing |
| 225 | 📋 Release Notes button | button | ✅ | |
| 226 | 🔁 Restart CWOC button (admin) | button | ❌ | Missing |
| 227 | Upgrade modal (terminal log + Start/Close/Copy) | modal | ❌ | Missing |
| 228 | Release Notes modal (with Older/Newer navigation) | modal | ⚠️ | Android has placeholder dialog, no actual content fetch |

---

## GLOBAL/TOOLBAR ELEMENTS

| # | Web Element | Type | Android Status | Notes |
|---|-------------|------|----------------|-------|
| 229 | ✅ Saved indicator button (disabled) | button | ❌ | Android uses FAB save button |
| 230 | 📌 Save & Stay button | button | ❌ | Missing — Android only has single save FAB |
| 231 | 🚪 Save & Exit button | button | ❌ | Missing |
| 232 | Exit button | button | ⚠️ | Android has back arrow in top bar |
| 233 | Unsaved changes detection + prompt | behavior | ❌ | Missing — no dirty tracking/prompt |


---

## SUMMARY

### Totals

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Fully implemented | 52 | 22% |
| ⚠️ Partial/different | 22 | 9% |
| ❌ Missing entirely | 115 | 49% |
| 🔲 Placeholder only | 0 | 0% |
| N/A (not applicable) | 3 | 1% |
| **Total items audited** | **233** (excl. N/A: 230) | |

### Critical Gaps by Category

**1. Chit Display Options (items 19-29)** — 11 checkboxes completely missing
- These control core visual behavior (fade past, highlight overdue/blocked, tab counts, map thumbnails)
- High impact on user experience

**2. Visual Indicators (items 30-39)** — 10 selects completely missing
- Controls which indicators show on chit cards
- Affects information density on all views

**3. Clocks/World Clocks (items 7-11)** — Mostly missing
- Active/inactive clock grid with drag-drop
- HST (metric time) option missing from time format

**4. Omni View Settings (items 46-54)** — Entirely missing
- Layout configurator, color mode, locked filters, bundle toggles
- Critical for Omni View users

**5. Calendar Advanced Settings (items 56-57, 64-67)** — Missing
- View hours, scroll-to hour, X-days count, work hours/days
- Affects calendar usability

**6. Custom Filters & Sorting (items 40-41)** — Missing
- Per-view default filter/sort configuration

**7. Admin: User Management & Instance Config (items 157, 159-162)** — Missing
- Manage Users, Instance Name, Welcome Message, Session Lifetime

**8. Admin: Data Import Variety (items 167-175)** — Missing
- Separate chit/user exports, ICS/Google Tasks/Google Keep imports

**9. Dependent Apps: Full Configuration (items 188-218)** — Mostly stubs
- Tailscale: only status shown, no config
- Ntfy: basic fields only, no enable/disable toggle
- HA: basic fields only, missing webhook, poll interval

**10. Tag Editor: Advanced Features (items 79, 81-89)** — Missing
- Favorites, sharing, font color, preview chip

### Behavioral Differences

1. **Save mechanism**: Web has Save & Stay / Save & Exit / unsaved detection. Android has single FAB save with no dirty tracking.
2. **Snooze options**: Web 1/3/5/10 min vs Android 5/10/15/30/60 min — completely different ranges.
3. **Sex labels**: Web "♂ Man / ♀ Woman" vs Android "Male / Female" — cosmetic but inconsistent.
4. **Calendar snap**: Web includes "None" option, Android doesn't.
5. **Read receipts**: Web has 4 options (Never/Always/Ask/Contacts only), Android has simple on/off toggle.
6. **Bundle count display**: Web has 4 options (Both/Unread/Total/Hidden), Android has simple toggle.
7. **Tag editor**: Web has hierarchical tree with drag-drop reorder; Android has flat list.
8. **Badges tab placement**: Web puts badges inside Email tab; Android has separate Badges tab.
