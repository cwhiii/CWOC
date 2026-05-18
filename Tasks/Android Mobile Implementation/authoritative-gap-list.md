# Authoritative Gap List: Android App vs Mobile Web

**Generated:** 2026-05-17
**Comparison:** Android app (current deployed code) vs web app (mobile browser)
**Scope:** Complete functional equivalence — every button, every behavior, every interaction

---

## A1 — No parchment theme (Material 3 defaults instead of brown/gold aesthetic)

1. App uses Material 3 default color scheme instead of CWOC brown/gold/parchment palette
2. No parchment background texture on any screen
3. Card backgrounds use Material 3 `surface` color instead of `#fffaf0` / `#f5e6d3`
4. Zone headers use Material 3 `primary` color instead of `#6b4e31` brown
5. Buttons use Material 3 styling instead of CWOC `.zone-button` style (brown border, parchment background)
6. Dividers use Material 3 default instead of `#c9b896` gold
7. Input fields use Material 3 `OutlinedTextField` styling instead of CWOC inset border with parchment background
8. Tab bar / navigation uses Material 3 `NavigationBar` instead of CWOC tab strip with icons and underline

## A2 — No Lora font (system default instead)

1. All text renders in system default font (Roboto) instead of Lora serif variable font
2. No self-hosted Lora font files included in the app assets
3. Typography scale uses Material 3 defaults instead of CWOC's Lora-based hierarchy

## A3 — No parchment background texture

1. No `parchment-bg.jpg` or equivalent texture applied to any screen background
2. All screens have flat solid color backgrounds instead of textured parchment

## A4 — Login welcome message not rendered as markdown

1. Login screen welcome message displays as plain text instead of rendering markdown formatting
2. No `marked.js` equivalent (markdown renderer) applied to the welcome message field

## A5 — No profile menu (avatar, switch user, logout)

1. No profile avatar button in the top bar of any screen
2. No dropdown menu with user info, switch user, and logout options
3. No profile image display anywhere in the app
4. No logout action accessible from the main navigation (only from settings/admin)
5. No "switch user" capability


## B1 — No tag chips on cards (Tasks, Notes, Checklists)

1. Task cards show no tag chips — web shows colored tag pills below the title
2. Note cards show no tag chips
3. Checklist cards show no tag chips
4. No tag color applied to chips (web uses tag's configured color as chip background)
5. No tag font color contrast logic on cards

## B2 — No chit color applied to cards (background/border from chit.color)

1. Task cards have no color indicator (web applies chit.color as left border or background tint)
2. Note cards have no color indicator
3. Checklist cards have no color indicator
4. Calendar event cards in Day/Week list view show a color dot but no background tint
5. No color-based card border on any list view

## B3 — No checklist progress count on cards ("3/7 complete")

1. Task cards with checklists don't show progress count
2. No progress bar on task cards that have checklist data
3. Checklist screen cards show inline items but no summary "X/Y complete" count in a compact form

## B4 — No people chips on cards

1. No people/contact names displayed on any card in any list view
2. Web shows small people chips (with optional contact image) on cards

## B5 — No overdue border (red border on past-due tasks)

1. Tasks with past due dates have no visual distinction (no red border, no red text, no overdue indicator)
2. No "overdue" label or icon on cards with expired due dates

## B6 — No weather indicator on cards

1. No weather icon/temperature shown on calendar event cards that have a location + date
2. No weather data fetched for card display

## B7 — No map thumbnail on cards

1. No small map preview image on cards that have a geocoded location
2. No static map tile displayed on any card

## B8 — No sharing/stealth indicator on cards

1. No "shared" icon on cards that are shared with other users
2. No "stealth" (eye-slash) icon on cards marked as stealth
3. No owner indicator on cards owned by other users

## B9 — No archive/snooze indicators on cards

1. No "archived" visual indicator on cards (web shows a muted/faded appearance)
2. No "snoozed until [time]" indicator on cards that are snoozed
3. Archived cards are not visually distinguished from active cards

## B10 — No visual indicators system (_getAllIndicators)

1. No unified indicator system that shows health data badges on cards
2. No small chart sparklines or latest-value badges on cards with health indicator data
3. Web's `_getAllIndicators()` function renders multiple indicator types on cards — none of this exists

## B11 — No tab counts (number of items per tab)

1. Navigation tabs/items don't show a count badge (e.g., "Tasks (12)")
2. No unread/pending count on any tab
3. Web shows item counts next to each C CAPTN tab label

## B12 — No chit display options (fade past events, highlight overdue)

1. No "fade past events" setting that dims cards for events that have already occurred
2. No "highlight overdue" setting that adds red emphasis to overdue items
3. No display options accessible from any view's settings/toolbar

## B13 — Pinned items don't sort to top

1. Pinned items show a "📌 Pinned" text label but are not sorted to the top of their list
2. Web always renders pinned items before non-pinned items regardless of sort order
3. The pin indicator exists but has no effect on sort position

## B14 — Snoozed items don't auto-hide/show based on time

1. Snoozed items remain visible in lists (web hides them until snooze time expires)
2. No background timer that re-shows snoozed items when their snooze period ends
3. No "snoozed" filter that automatically excludes snoozed items from the default view


## C1 — Day/Week view is a flat list, not a time grid

1. Day view renders events as a flat LazyColumn of cards — web renders a vertical time grid (24 hours) with events positioned at their start time and sized by duration
2. Week view is identical to Day view (flat list) — web renders 7 columns side-by-side with a shared time axis
3. No hour labels along the left edge
4. No time grid lines (horizontal lines at each hour/half-hour)
5. Events are not positioned vertically by their start time
6. Events are not sized vertically by their duration
7. No visual representation of event overlap (web stacks overlapping events side-by-side)
8. No "current time" red line indicator showing the present moment

## C2 — No drag-to-resize events

1. No bottom-edge drag handle on calendar events to change end time
2. No resize interaction of any kind on calendar events

## C3 — No drag-to-move events

1. No drag gesture to move events to a different time slot
2. No drag gesture to move events to a different day (in week view)
3. No visual feedback during drag (ghost/shadow of event being moved)

## C4 — No click-to-create on empty time slot

1. Tapping an empty area in the calendar does not create a new chit at that time
2. No "double-click empty slot" equivalent (double-tap) to create a new event
3. Web allows clicking any empty time slot to pre-fill start time for a new chit

## C5 — No multi-day event spanning

1. Events that span multiple days are not rendered as a continuous bar across day columns
2. Multi-day events appear only on their start date (or are duplicated per day without visual connection)
3. No "continuation" indicator showing an event continues from/to adjacent days

## C6 — No weather overlay on calendar day headers

1. No weather icon/temperature shown in day column headers
2. No weather data fetched for calendar date headers
3. Web shows weather forecast icons in the day header area

## C7 — No pinch-to-zoom

1. No pinch gesture to zoom in/out on the calendar time grid
2. No zoom level that changes the visible hour range or time slot granularity
3. Web supports pinch-to-zoom to expand/compress the time axis

## C8 — Tap event doesn't open editor (onNavigateToEditor not passed)

1. In Day/Week `EventList`, event cards have no `clickable` modifier — tapping does nothing
2. In CalendarScreen, the `EventList` composable renders cards without click handlers
3. Itinerary and X-Day views have `onEventTap` callbacks but CalendarScreen passes empty lambdas (`{ /* navigate to editor */ }`)
4. Only Month view (tap day → switch to Day) and Year view (tap month → switch to Month) have working tap handlers

## C9 — Month view is a stub (not a real grid)

1. Month view IS implemented as a real grid with day cells and event dots — this gap may be partially resolved
2. However: tapping a day only switches to Day view mode, it doesn't navigate to that specific date
3. No ability to tap an event dot to see which events are on that day (no popup/tooltip)
4. No drag-to-create across multiple days in month view

## C10 — Year view is a stub (not 12 mini-month grids)

1. Year view IS implemented as 12 mini-month grids in a 3×4 layout — this gap may be partially resolved
2. However: tapping a month only switches to Month view mode without navigating to that specific month
3. No event count badges on months (web shows total event count per month)

## C11 — Itinerary/X-Day views are stubs

1. Itinerary view IS implemented with day grouping and event cards — partially resolved
2. X-Day view IS implemented with horizontal scrollable columns — partially resolved
3. However: both pass empty lambdas for `onEventTap` in CalendarScreen, so tapping events does nothing
4. No configurable X-Day count (hardcoded to 7, web allows user to set custom day count)
5. No "Work Hours" view mode (web has a separate work-hours-only time grid)

## C12 — No today highlight, no week numbers

1. Month view DOES have today highlight (primary color circle) — partially resolved
2. Year view DOES have today highlight — partially resolved
3. No week numbers displayed in any calendar view (web shows ISO week numbers in the left margin)
4. Day/Week flat list has no "today" visual distinction
5. No "jump to today" indicator in the event list when scrolled away from today


## D1 — No masonry layout (single column instead of multi-column)

1. Notes screen renders as a single-column LazyColumn — web renders notes in a multi-column masonry grid
2. No responsive column count based on screen width
3. Cards are all full-width instead of variable-height tiles arranged in columns

## D2 — No drag-to-reorder for notes

1. No drag handle on note cards
2. No long-press-to-drag gesture for manual reordering
3. No visual feedback during drag (card lifting, drop target indicators)
4. Manual sort order is not persisted for notes

## D3 — No quick-edit modal for notes

1. No shift+click (or equivalent gesture) to open an inline edit modal for a note
2. Web allows shift+clicking a note card to expand it in-place for quick editing without navigating to the full editor
3. No "edit in place" capability — only full editor navigation

## D4 — No tags/color/people/sharing on note cards

1. Note cards show only title + markdown preview + pin indicator
2. No tag chips displayed on note cards
3. No color indicator (border or background tint) on note cards
4. No people chips on note cards
5. No sharing/stealth indicator on note cards

## D5 — No notebook view (combined Notes + Checklists)

1. No "Notebook" tab/view that combines notes and checklists into a single unified view
2. Web has a Notebook tab that shows both note-type and checklist-type chits together
3. No toggle between Notes-only, Checklists-only, and combined Notebook mode

## D6 — Notes drag-reorder with column awareness

1. No drag-reorder at all (see D2)
2. No column-aware drop targeting (web's masonry layout allows dropping between columns)

## D7 — No inline note editing (expand/collapse preview)

1. No ability to expand a note card in-place to edit its content
2. No "click to expand, edit, click to collapse" pattern
3. All editing requires full navigation to the editor screen


## E1 — Due date "Complete" checkbox missing

1. The DateZone has a "Due Only" mode but no inline "Complete" checkbox next to the due date field
2. Web shows a "Complete" checkbox that appears when Due mode is selected, which sets status to Complete
3. No `onDueCompleteToggle()` equivalent behavior

## E2 — Point in Time "Now" button missing

1. The Point in Time date mode has date and time pickers but no "Now" button
2. Web has a "Now" button that instantly sets the point-in-time to the current date and time
3. User must manually pick today's date and current time separately

## E3 — All Day toggle not in zone header (in body as Switch)

1. The All Day toggle is inside the zone body as a Switch below the date fields
2. Web places the All Day toggle as a button in the zone header bar for quick access without expanding the zone
3. Functional equivalence exists but placement differs from web's header-button pattern

## E4 — Repeat checkbox not in dates zone header (separate zone)

1. Recurrence is a completely separate zone (`RecurrenceZone`) below the Dates zone
2. Web has a "🔁 Repeat" checkbox row inside the Dates zone body, with recurrence options inline
3. The repeat toggle is not visible without scrolling to and expanding the separate Recurrence zone
4. Web's pattern: Repeat is a checkbox within Dates that reveals inline options when checked

## E5 — Timezone abbreviation labels on date fields

1. No timezone abbreviation (e.g., "EST", "PST") displayed next to date/time values
2. Web shows the timezone abbreviation as a small label next to each date field
3. The timezone selector exists but the abbreviation is not shown inline with the date values

## E6 — Timezone suggestion from geocoded location

1. No automatic timezone suggestion when a location is entered/geocoded
2. Web suggests a timezone based on the geocoded coordinates of the location field
3. No integration between Location zone and Dates zone for timezone inference


## F1 — Assignee dropdown has EMPTY options (sharedUsers never loaded)

1. The Assignee dropdown exists but `editorSettings.sharedUsers` may be empty if the settings don't have shared users configured
2. Web populates the assignee dropdown from `/api/settings` shared users list
3. Need to verify the settings sync actually populates this field — if the API returns shared users, they should appear

## F2 — Auto-Complete Checklist not in zone header button

1. Auto-Complete Checklist is a Switch toggle in the main form body (between Assignee and Dates zone)
2. Web places it as a button in the Task zone header bar
3. Functionally equivalent but not in the zone header position

## F3 — Habit toggle not in zone header button

1. The Habit toggle is inside the Habits zone body as the first Switch
2. Web places the Habit toggle as a button in the Task zone header bar for quick access
3. User must scroll to and expand the Habits zone to toggle habit mode

## F4 — No inline status change dropdown on list cards

1. Task cards in the Tasks list view have no inline status dropdown
2. Web allows changing a task's status directly from the card without opening the editor
3. The only way to change status is to navigate to the full editor


## G1 — Frequency and Reset Period write to same field (conflict)

1. HabitsZone has both `ResetPeriodDropdown` and `FrequencyDropdown` but both call `onResetPeriodChange`
2. The FrequencyDropdown writes a "N:UNIT" format string to the same field as the reset period
3. Web has separate `habitFrequency` and `habitResetPeriod` fields that don't conflict
4. The two dropdowns may overwrite each other's values

## G2 — Reset period missing interval value input

1. Web has a numeric input for the reset interval (e.g., "Every 2 weeks") — the Android ResetPeriodDropdown only offers Daily/Weekly/Monthly with no interval
2. No way to set "reset every 3 days" or "reset every 2 weeks" — only fixed period options
3. The FrequencyDropdown attempts to parse "N:UNIT" format but the ResetPeriodDropdown writes plain strings like "daily"

## G3 — No completion chart (Canvas)

1. No completion history chart in the Habits zone
2. Web has a Canvas-based completion chart showing daily/weekly completion over time
3. The HabitsZone only shows a LinearProgressIndicator for current period progress

## G4 — No success rate chart (Canvas)

1. No success rate chart in the Habits zone
2. Web has a Canvas-based success rate chart showing percentage over time
3. Only a text-based "Success Rate: X%" is shown

## G5 — No streak chart (Canvas)

1. No streak visualization chart in the Habits zone
2. Web has a Canvas-based streak chart showing streak length over time
3. Only a text-based "Current Streak: X periods" is shown

## G6 — No period history list

1. No scrollable list of past habit periods with their completion status
2. Web has a collapsible "History" section with a two-column list of past periods
3. The HabitStatsDisplay only shows current streak and current period progress


## H1 — No geocoding (text input only, no coordinate resolution)

1. Location zone has a text input but no geocoding to resolve addresses to coordinates
2. No call to OpenStreetMap Nominatim or any geocoding API
3. No latitude/longitude stored from the location text
4. Map preview cannot be shown without coordinates

## H2 — No map preview (embedded map)

1. No inline map preview in the Location zone showing the geocoded location
2. Web shows an embedded OpenStreetMap tile with a marker at the geocoded coordinates
3. The "Map" button opens an external maps app instead of showing an inline preview

## H3 — No search/geocode button

1. No "Search" button in the Location zone header that triggers geocoding
2. Web has a Search button that geocodes the entered text and shows the map preview
3. The location text is never resolved to coordinates within the app

## H4 — No context button (view in maps page)

1. No "Context" button that opens the location in the app's own Maps screen
2. Web has a "Context" button that navigates to the Maps page centered on this location
3. The "Map" AssistChip opens an external app (Google Maps) instead of the in-app map

## H5 — No weather display for location+date

1. No weather forecast shown in the Location zone when both a location and date are set
2. Web shows weather data (temperature, conditions) for the chit's location on the chit's date
3. No integration between Location zone, Dates zone, and weather API

## H6 — Geocode cache (shared across app)

1. No geocoding cache that stores previously resolved address→coordinate mappings
2. Web maintains a geocode cache to avoid redundant API calls
3. Every geocode request (if implemented) would be a fresh API call


## I1 — No recent tags row (settings.recentTags not loaded)

1. Tags zone has a "Favorites" row but no "Recent" row showing recently used tags
2. Web shows both "Favs:" and "Recent:" rows for quick tag access
3. No tracking of recently used tags for quick re-application

## I2 — No expand/collapse all button

1. No "Expand All" / "Collapse All" button in the Tags zone header
2. Web has a toggle button that expands or collapses all tag tree groups at once
3. TagsPickerSheet has individual expand/collapse per node but no bulk toggle

## I3 — No tag edit/delete (only create)

1. Tags can be created via the TagsPickerSheet "Create new tag" input
2. No ability to edit an existing tag's name, color, or parent
3. No ability to delete a tag from the tag tree
4. No right-click/long-press context menu on tags for edit/delete actions
5. Web allows editing tag name, color, font color, and deleting tags


## J1 — Format toolbar appends to end instead of wrapping selection

1. Notes format toolbar buttons (Bold, Italic, etc.) append formatted text at the end of the note
2. `wrapSelection()` helper literally appends `**text**` to the end — it doesn't wrap the user's current text selection
3. Web wraps the currently selected text with the formatting delimiters (e.g., selecting "hello" and clicking Bold produces `**hello**`)
4. No access to TextField selection state (start/end cursor positions) for proper wrap behavior

## J2 — No side-by-side live preview (toggle only)

1. Notes zone has a "Preview" toggle that switches between edit and rendered view
2. No side-by-side mode showing edit on left and rendered preview on right simultaneously
3. Web has a "Live Preview" mode (split view) in the full-screen notes modal
4. The FullEditorModal only has a toggle between edit and preview, not a split view

## J3 — No download button (.md file)

1. No "Download" button to save the note content as a .md file
2. Web has a download button that creates and downloads a markdown file
3. The "Send" AssistChip shares via Android share sheet but doesn't save to local storage as a file

## J4 — No to-checklist action (move lines to checklist)

1. No "Move to checklist" button that converts note lines into checklist items
2. Web has a "Move to checklist" action in the Notes zone header Data menu
3. No way to convert note content to checklist items without manual re-entry

## J5 — No [[ ]] chit link autocomplete

1. No `[[` trigger that opens an autocomplete dropdown of chit titles for linking
2. Web detects `[[` typed in the notes textarea and shows a searchable chit picker
3. No chit-to-chit linking capability in the notes field

## J6 — No Enter key list continuation (auto-continue bullets/numbers)

1. No automatic continuation of bullet lists or numbered lists when pressing Enter
2. Web's `_notesListContinue()` function detects when the cursor is at the end of a `- ` or `1. ` line and auto-inserts the next list prefix
3. User must manually type `- ` or `1. ` for each new list item


## K1 — No drag-drop reorder (move up/down buttons only)

1. Checklist items have Move Up/Move Down icon buttons for reordering
2. No drag handle or long-press-to-drag gesture for direct drag-drop reordering
3. Web uses drag handles for fluid drag-drop reordering of checklist items
4. The button-based approach works but is slower and less intuitive than drag-drop

## K2 — No cross-chit checklist move

1. No ability to move a checklist item from one chit's checklist to another chit's checklist
2. Web has a "Send item to another chit" action on checklist items
3. No chit picker modal for selecting the destination chit

## K3 — No send-item to another chit

1. No "send to another chit" action on individual checklist items
2. Web allows sending a single checklist item (or selected items) to a different chit
3. No UI for selecting a target chit and transferring items


## L1 — Wrong type names (alarm/timer/reminder vs notification/alarm/timer/stopwatch)

1. Android AlertsZone uses types: "alarm", "timer", "reminder"
2. Web uses types: "notification", "alarm", "timer", "stopwatch" (4 types, different names)
3. "reminder" in Android ≠ "notification" in web — the semantics and behavior differ
4. The type names don't match the web's data model, causing sync/display inconsistencies

## L2 — No stopwatch type

1. AlertsZone has no "Stopwatch" type option — only alarm/timer/reminder
2. Web has a dedicated Stopwatch button that creates a running stopwatch with lap tracking
3. No stopwatch creation, display, or interaction in the Android editor
4. No stopwatch modal with current time display and laps list

## L3 — No days-of-week selection for alarms

1. AlertsZone's alarm creation has no day-of-week checkboxes (Mon-Sun)
2. Web's alarm modal has a "Repeat" dropdown (None/Daily/Weekly/Weekdays/Weekends) and individual day checkboxes
3. No way to set an alarm to repeat on specific days of the week

## L4 — No duration input for timers

1. AlertsZone's timer creation uses the same offset picker as other alert types
2. Web's timer modal has separate Hours:Minutes:Seconds number inputs for duration
3. No HH:MM:SS duration input for timers

## L5 — No loop toggle for timers

1. No "Loop Timer" checkbox when creating a timer
2. Web's timer modal has a "Loop Timer" checkbox that makes the timer restart automatically
3. Timer looping behavior is not configurable

## L6 — No default notifications auto-populate from settings

1. When creating a new chit, no default notifications are automatically added from user settings
2. Web auto-populates default notification alerts from the user's settings configuration
3. User must manually add every notification for every new chit

## L7 — No in-app alarm sound playback

1. No audio playback when an alarm fires within the app
2. Web plays an alarm sound file when an alarm triggers
3. Android notifications may play a sound via the system, but no in-app audio feedback


## M1 — No contact tree (flat autocomplete only)

1. People zone uses a flat autocomplete list from contact names
2. Web shows a hierarchical contact tree (grouped by organization, relationship, etc.)
3. No tree structure with expand/collapse groups in the People zone
4. No visual grouping of contacts by any criteria

## M2 — No system user role toggles (Viewer/Manager)

1. No ability to assign roles (Viewer/Manager) to people added to a chit
2. Web shows role toggle buttons next to each person chip for shared chits
3. No sharing permission model visible in the People zone

## M3 — No contact images/colors on chips

1. People chips are plain text InputChips with no avatar/image
2. Web shows contact profile images (or colored initials) on people chips
3. No color indicator from the contact's configured color

## M4 — Assignee dropdown not synced with People zone

1. The Assignee dropdown (in the Task section) and the People zone are independent
2. Web syncs the assignee with the people list — adding someone as assignee also adds them to people
3. No bidirectional sync between the two fields

## M5 — No people expand modal (full-screen picker)

1. No full-screen modal for the People zone (web has an "Expand" button that opens a full-screen people picker)
2. The People zone is always inline — no expanded view with more space for the contact tree
3. Web's expand modal shows the full contact tree with search, expand/collapse all, and stealth toggle


## N1 — No chit picker (raw ID input only)

1. Adding child chits requires typing a raw chit ID into a text field
2. Web has a chit picker modal that shows a searchable list of chits by title
3. No way to browse/search existing chits when adding children to a project
4. User must know and manually enter the UUID of the chit they want to add

## N2 — No "Create new child" button

1. No button to create a brand-new chit that is automatically added as a child of this project
2. Web has a "Create New" button that creates a new chit and links it as a child in one action
3. User must create a chit separately, note its ID, then manually add it as a child

## N3 — No "Move to Project" dropdown

1. No dropdown to add the current chit as a child of an existing project
2. Web has an "Add to Project" dropdown that lists all project master chits
3. No way to nest the current chit under a project from within the editor

## N4 — No Kanban board display in editor

1. The Projects zone in the editor shows child chit IDs as chips — no Kanban board
2. Web renders a full Kanban board (columns by status) inside the editor's Projects zone when the chit is a project master
3. No visual representation of child chit status distribution in the editor

## N5 — No child chit cards (only truncated IDs)

1. Child chits are displayed as InputChips showing the first 8 characters of the ID + "…"
2. Web shows full child chit cards with title, status, due date, and action buttons
3. No title resolution — user sees meaningless ID fragments instead of chit titles
4. No status indicator on child chit chips
5. No action buttons (open, move, remove, delete) on child chit representations


## O1 — Health Indicators: raw JSON instead of structured UI

1. Health Indicators zone is a plain text field labeled "Health Data (JSON)"
2. Web renders structured UI with custom object definitions — labeled fields, dropdowns, number inputs per indicator type
3. No parsing of health data JSON into individual indicator fields
4. No "add reading" button for each indicator type
5. No chart/sparkline preview of recent readings
6. User must manually write valid JSON to enter health data

## O2 — Email: no autocomplete on From/To

1. Email zone From/To/CC/BCC fields are plain OutlinedTextFields with no autocomplete
2. Web has autocomplete dropdowns on To/CC/BCC that suggest contacts with email addresses
3. No contact email lookup when typing in email recipient fields

## O3 — Email: no format toolbar on body

1. Email body is a plain OutlinedTextField with no formatting toolbar
2. Web has a full markdown format toolbar (Bold, Italic, Strikethrough, Link, Lists, Blockquote, Code) on the email body
3. No formatting assistance for composing email bodies

## O4 — Email: no PGP encrypt

1. No PGP encryption button or toggle in the Email zone
2. Web has a "PGP" button that encrypts the email body using OpenPGP.js
3. No PGP key lookup from contacts
4. No encryption/decryption capability

## O5 — Email: no Send/Send Later/Reply/Forward

1. No Send button in the Email zone
2. No "Send Later" button for scheduling email delivery
3. No Reply button that pre-fills the To field and quotes the original message
4. No Forward button that pre-fills the body with the forwarded content
5. No "Discard Draft" button
6. Web has all of these as buttons in the Email zone header

## O6 — Attachments: placeholder only (no file list/upload/download/delete)

1. Attachments zone shows "Attachments data present" or "No attachments. Upload from the web editor."
2. No file list showing attachment names, sizes, and types
3. No upload button or drag-and-drop area for adding files
4. No download button for individual attachments
5. No delete button for removing attachments
6. Web has a full file management UI with upload, download, and delete per attachment

## O7 — Series Log: placeholder text, no actual data

1. Series Log zone shows static text: "Recurrence instance log for chit {id}. View full history on the web editor."
2. No actual recurrence instance data loaded or displayed
3. Web shows a list of past recurrence instances with dates and status
4. No API call to fetch series log data

## O8 — Options menu: no QR code action

1. Options menu has Delete, Duplicate, Share — but no QR Code option
2. Web has a "📱 QR Code" option that generates and displays a QR code for the chit
3. No QR code generation capability in the editor

## O9 — No instance banner for recurrence editing

1. No banner at the top of the editor indicating "You are editing an instance of a recurring chit"
2. Web shows a banner with options: "Edit this instance only" vs "Edit all future instances" vs "Edit the series"
3. No recurrence instance editing mode selection
4. Editing a recurring chit may silently modify the series without user awareness

## O10 — No auto-save system

1. The editor has a `lastSavedAt` indicator and `saveAndStay()` function
2. However, there is no automatic periodic save (web's `CwocAutoSave` saves every N seconds when dirty)
3. The "✅ Saved" indicator only appears after manual save actions
4. No configurable auto-save interval
5. No auto-save on app backgrounding or screen lock


## P1 — Nest thread label not clickable

1. The nest thread label (`nestButtonLabel`) shows "Thread" as a static Box with text
2. Web's nest label is clickable and opens the thread picker to change/view the thread
3. No tap handler on the nest thread label in the Android editor

## P2 — Pin toggle not in title row (in TopAppBar instead)

1. Pin toggle is an IconButton in the TopAppBar actions area
2. Web places the pin toggle (bookmark icon) directly in the title row, left of the title input
3. Functionally equivalent but positionally different — web's placement is more prominent and always visible without scrolling


## Q1 — No drag-drop between Kanban columns

1. Kanban board in Projects screen has no drag-drop to move child chits between status columns
2. Web allows dragging cards between ToDo/In Progress/Blocked/Complete columns
3. The only way to change a child chit's status is to open it in the editor

## Q2 — Child cards don't show due date

1. Kanban child chit cards show only the title (max 2 lines)
2. Web shows due date on child cards in the Kanban board
3. No date information visible on Kanban cards

## Q3 — Child cards don't have status dropdown

1. No inline status dropdown on Kanban child cards
2. Web allows changing status directly from the Kanban card without opening the editor
3. Status can only be changed by navigating to the full editor

## Q4 — Child cards don't have open/move/remove/delete buttons

1. Kanban child cards only have a tap-to-navigate action
2. Web shows action buttons on child cards: Open, Move (to different column), Remove (from project), Delete
3. No context menu or action buttons on Kanban cards
4. No way to remove a child from the project without opening the editor

## Q5 — No "Add existing chit" button

1. No button on the Kanban board to add an existing chit as a child
2. Web has an "Add Chit" button that opens a chit picker to add existing chits to the project
3. Children can only be added from within the editor's Projects zone (by typing raw IDs)

## Q6 — No "Create new child" button

1. No button on the Kanban board to create a new child chit
2. Web has a "Create New" button on the Kanban board that creates a new chit pre-linked to the project
3. Must navigate away to create a new chit and manually link it

## Q7 — No project progress bar

1. No progress bar showing overall project completion (% of children in Complete status)
2. Web shows a progress bar on project cards indicating completion percentage
3. No visual summary of project health/progress


## R1 — No inline snooze button (only via long-press menu)

1. Alert cards have no visible snooze button — snooze is only accessible via long-press → ChitActionMenu → Snooze
2. Web has an inline snooze button directly on each alert card
3. Requires two interactions (long-press + menu tap) instead of one tap

## R2 — No inline dismiss button

1. No dismiss button on alert cards to mark an alert as dismissed/acknowledged
2. Web has an inline dismiss button on each alert
3. No way to dismiss an alert without opening the editor

## R3 — No independent alerts board

1. No "Independent" mode that shows standalone alerts not attached to chits
2. Web has a "List" vs "Independent" mode toggle — Independent shows alerts created from the dashboard without a parent chit
3. No mode toggle of any kind on the Alerts screen

## R4 — No stopwatch display

1. No stopwatch cards showing running time, start/stop/lap buttons
2. Web displays active stopwatches with real-time counting display and lap tracking
3. No stopwatch UI anywhere in the app

## R5 — No timer countdown display

1. No live countdown display on timer alert cards
2. Web shows active timers with a real-time countdown (HH:MM:SS decreasing)
3. Timer alerts show only their scheduled time, not remaining time

## R6 — Filter is a no-op (all alerts pass through)

1. The AlertsScreen filter logic has a comment: `true // Alerts pass through since they're derived`
2. Filters from FilterSortViewModel are collected but not actually applied to alert items
3. Web filters alerts by the same criteria as other views (status, tags, people, etc.)

## R7 — No "List" vs "Independent" mode toggle

1. No mode toggle on the Alerts screen
2. Web has a toggle between "List" mode (alerts from chits) and "Independent" mode (standalone alerts)
3. No way to view or create independent/standalone alerts

## R8 — No notification action buttons (snooze/dismiss from shade)

1. Android notifications don't have action buttons for snooze/dismiss in the notification shade
2. Web's notification system allows snooze/dismiss directly from the browser notification
3. User must open the app to interact with alerts (this is partially an Android notification channel configuration issue)


## S1 — All charts same color (should differ per type)

1. All indicator charts use the same color (`Color(0xFF6B4E31)` brown) for lines and points
2. Web uses different colors per indicator type (e.g., red for heart rate, blue for blood pressure, green for weight)
3. No per-type color configuration or automatic color assignment

## S2 — No "add new reading" button

1. No button on indicator chart cards to add a new data point/reading
2. Web has an "Add Reading" button that opens an input for entering a new value
3. The only way to add health data is through the editor's Health Indicators zone (which is raw JSON)

## S3 — No chart legend

1. No legend showing what the chart line represents (unit, type name, color key)
2. Web shows a legend with the indicator name and unit
3. Only the chart type name is shown as the card title — no axis labels or unit indicators


## T1 — Saved locations not shown as markers

1. Map screen only shows chit location markers — no saved locations from settings
2. Web shows saved locations as distinct markers on the map
3. No differentiation between chit locations and saved/favorite locations

## T2 — No settings integration (default lat/lon/zoom)

1. Map defaults to zoom level 12.0 with no configured center point
2. Web uses default latitude/longitude/zoom from user settings for initial map position
3. No settings-driven map configuration

## T3 — Text addresses not geocoded (most chits invisible)

1. MapViewModel only shows chits that already have coordinates (from `markers` StateFlow)
2. Chits with text-only addresses (no lat/lon) are not geocoded and don't appear on the map
3. Web geocodes text addresses to show them as markers
4. Most chits likely have text addresses only, making the map appear empty


## U1 — Not inline in sidebar (dedicated screen)

1. Search is a separate full-screen with its own route (`search`)
2. Web has search inline in the sidebar — always accessible without navigating away from the current view
3. Searching requires leaving the current view entirely
4. No persistent search field visible in the main navigation

## U2 — Doesn't search location field

1. SearchViewModel searches title, notes, tags, and people (based on placeholder text)
2. No search of the `location` field content
3. Web searches all fields including location text

## U3 — Doesn't search checklist items

1. Search does not look inside checklist item text
2. Web searches within checklist item content
3. A checklist item containing the search term won't surface its parent chit in results


## V1 — Missing "Rejected" status option

1. FilterState/FilterEngine may not include "Rejected" as a filterable status option
2. Web's filter panel includes Rejected as a status filter option
3. Need to verify FilterState includes all 5 statuses (ToDo, In Progress, Blocked, Complete, Rejected)

## V2 — Missing "Show Declined" toggle

1. No "Show Declined" toggle in the filter UI
2. Web has a toggle to show/hide declined (rejected) items
3. No equivalent filter control in the Android filter/sort system

## V3 — No color filter

1. No ability to filter chits by their color
2. Web's filter panel includes a color filter with swatches
3. FilterState has no color field

## V4 — No date range filter

1. No ability to filter chits by a date range (start/end date bounds)
2. Web's filter panel includes date range inputs
3. FilterState has no date range fields

## V5 — No active filter count badge

1. No badge showing how many filters are currently active
2. Web shows a count badge on the filter button/icon indicating active filter count
3. The only indication of active filters is the "No chits match filters" empty state with "Clear Filters" button

## V6 — Manual sort: drag-to-reorder not implemented

1. Sort options exist (via SortEngine) but manual sort (drag-to-reorder) is not implemented
2. Web allows drag-to-reorder cards when "Manual" sort is selected
3. No drag handles on cards in any list view
4. No persistence of manual sort order


## W1 — ~94 fields missing (6 of ~100+ implemented)

1. General tab has 6 fields: time format, week start day, calendar snap, snooze length, default timezone, unit system
2. Web General tab has: all of the above PLUS sex toggle, date format, first day of week (separate from week start), default view, welcome message, login background, profile image upload, display name, and more
3. Missing from General: sex/gender toggle, date format preference, profile image, display name, welcome message editor
4. Missing entire sections that would be in General or their own tabs:
   - Saved Locations management (add/edit/delete saved locations with coordinates)
   - Tags management (create/edit/delete/reorder tags, set colors, set favorites)
   - Custom Filters configuration
   - Habits configuration (default goal, default frequency)
   - Clocks/World Clocks configuration (add/remove timezone clocks)
   - Visual Indicators configuration (define custom indicator types, units, ranges)
   - Collections settings
   - Kiosk mode settings
   - Home Assistant integration settings
   - Dependent Apps configuration
   - Install App / PWA section (N/A for native but equivalent "app info" section)

## W2 — Entire Email tab missing

1. No Email settings tab exists
2. Web has a full Email tab with: IMAP server config, SMTP server config, email accounts, privacy settings, signature, auto-archive rules
3. No email account configuration anywhere in the app

## W3 — Entire Badges tab missing

1. No Badges settings tab exists
2. Web has a Badges tab for configuring achievement/gamification badges
3. No badge configuration or display anywhere in the app

## W4 — Views + Admin tabs have zero functional fields

1. Views tab has 3 sections (default view, enabled periods, view order) — these ARE functional
2. Admin tab has diagnostics only — no actual admin settings
3. Missing from Views: Omni View column configuration, Map Settings (default center/zoom), per-view card density, notebook mode toggle
4. Missing from Admin: Version display, Release Notes viewer, Data Management (export/import/purge), server URL config, user management link, audit log link


## X1 — Display name not shown/editable

1. Contact editor has given name, family name, middle, prefix, suffix — but no explicit "Display Name" field
2. Web has a display name field that can be set independently of the component name parts
3. The display name is computed from parts but not directly editable as its own field

## X2 — Phones/emails/addresses lack type labels (Home/Work/Mobile)

1. Multi-value fields show "Phone 1", "Phone 2" etc. — no type selector (Home/Work/Mobile/Other)
2. Web has a type dropdown next to each phone/email/address entry
3. No way to categorize contact info by type

## X3 — Call signs field missing

1. No "Call Signs" field in the contact editor
2. Web has a call signs field for amateur radio operators
3. Field not present in the Details zone or anywhere else

## X4 — X handles field missing

1. No "X Handles" (Twitter/X) field in the contact editor
2. Web has an X handles field for social media usernames
3. Not present in the Details zone

## X5 — Websites field missing

1. No "Websites" field in the contact editor
2. Web has a multi-value websites/URLs field
3. Not present in any zone

## X6 — Has Signal toggle missing

1. No "Has Signal" toggle/checkbox in the contact editor
2. Web has a toggle indicating whether the contact uses Signal messenger
3. Not present in the Details zone

## X7 — Signal username field missing

1. No "Signal Username" text field in the contact editor
2. Web has a Signal username field (shown when Has Signal is toggled on)
3. Not present in any zone

## X8 — PGP key field missing

1. No "PGP Key" field in the contact editor
2. Web has a PGP public key text area for storing the contact's encryption key
3. Not present in any zone

## X9 — Image upload (profile photo) missing

1. No profile photo upload capability in the contact editor
2. Web has an image upload area for contact profile photos
3. Contact list shows a generic person icon instead of actual photos
4. No camera or gallery picker for contact images

## X10 — Tags use comma input, not tree picker

1. Contact tags use a comma-separated text input with InputChips
2. Web uses the same tag tree picker as the chit editor (hierarchical, colored, with favorites)
3. No tag tree browsing, no tag colors, no favorites for contact tags

## X11 — Shared to vault toggle missing

1. No "Shared to vault" toggle in the contact editor
2. Web has a toggle for sharing the contact to a shared vault/directory
3. Not present in any zone

## X12 — QR code / vCard export missing

1. No QR code generation for the contact
2. No vCard export button
3. Web has both: a QR code button that generates a scannable vCard QR, and a download vCard button
4. No sharing of contact data in standard vCard format


## Y1 — Conflict banner "View in audit log" not clickable

1. The conflict banner exists (`showConflictBanner` state) but the "View in audit log" link is not implemented
2. No navigation from the conflict banner to the audit log page (which doesn't exist — see Z1)
3. Web's conflict banner has a clickable link that opens the audit log filtered to that chit

## Y2 — Contact conflict banner not shown in ContactEditorScreen

1. ContactEditorScreen has no conflict detection or banner display
2. Web shows a conflict banner on contacts that had merge conflicts during sync
3. No `hasUnviewedConflict` field checked for contacts

## Y3 — Lost edit log has no UI (user never informed)

1. When a sync conflict results in lost edits, the user is never notified
2. Web shows a notification/toast when edits are lost due to server-wins conflict resolution
3. No "lost edit" notification, log viewer, or recovery mechanism visible to the user

## Y4 — Attachment download progress not shown (StateFlow exists, no UI)

1. Attachment download progress StateFlow may exist in the data layer but no UI consumes it
2. No progress bar or percentage indicator during attachment downloads
3. Web shows download progress for large attachments


## Z1 — Audit Log page

1. No Audit Log screen exists in the app (no route, no screen file, no navigation entry)
2. Web has a full Audit Log page showing all changes to all chits with timestamps, field diffs, and user attribution
3. No way to view change history for any chit or the system as a whole

## Z2 — Custom Objects editor page

1. No Custom Objects editor screen exists in the app
2. Web has a Custom Objects editor for defining health indicator types, custom fields, and structured data schemas
3. No way to create or manage custom object definitions

## Z3 — Rules Manager page

1. No Rules Manager screen exists in the app
2. Web has a Rules Manager page for creating automation rules (if X then Y)
3. No rules engine UI

## Z4 — User Admin page

1. No User Admin screen exists in the app
2. Web has a User Admin page (admin-only) for managing users, permissions, and shared access
3. No user management capability

## Z5 — Habits dedicated view (within Tasks tab)

1. No "Habits" sub-view within the Tasks screen
2. Web has a mode toggle on the Tasks tab: Tasks / Habits / Assigned — the Habits mode shows only habit chits with their tracking UI
3. Tasks screen shows habit indicators on cards but no dedicated habits-only view with the full habit tracking interface

## Z6 — Assigned-to-Me view (within Tasks tab)

1. No "Assigned to Me" sub-view within the Tasks screen
2. Web has a mode toggle on the Tasks tab that includes "Assigned" — showing only chits assigned to the current user
3. No way to filter to only assigned-to-me chits without using the general filter system

## Z7 — Email dashboard tab (inbox/threads/bundles)

1. No Email tab in the app's navigation — see Section CC for full breakdown
2. Web has a complete email client as a dashboard tab

## Z8 — Notebook view (combined Notes+Checklists)

1. No Notebook view combining notes and checklists
2. Web has a "Notebook" tab that shows both note-type and checklist-type chits in a unified view
3. No toggle between Notes-only, Checklists-only, and combined mode


## AA1 — All 3 widgets non-functional on device

1. Widget directory exists (`widget/calendar/`, `widget/quickadd/`, `widget/refresh/`, `widget/tasks/`) but widgets don't function on device
2. Calendar widget doesn't display upcoming events
3. Quick-add widget doesn't create new chits
4. Tasks widget doesn't show task list
5. Refresh widget doesn't trigger sync
6. No widget configuration screens
7. No widget data refresh on sync completion


## BB1 — No unit conversion system (°C/°F, km/h/mph)

1. No unit conversion applied to weather data, distances, or health indicators
2. Web converts units based on the user's "unit system" setting (imperial/metric)
3. The unit system setting exists in General settings but is not applied anywhere in the app

## BB2 — No chit picker modal (reusable component)

1. No reusable chit picker modal that shows a searchable list of chits by title
2. Web has a shared chit picker used by: Projects zone (add child), Prerequisites zone (add prereq), Notes zone (send content), Checklist zone (send item)
3. All places that need to reference another chit use raw ID text input instead

## BB3 — No prompt modal (text input modal)

1. No reusable text input modal equivalent to web's `cwocPromptModal()`
2. Web uses prompt modals for: tag creation, rename operations, custom input requests
3. Android uses inline text fields or AlertDialogs instead — no standardized prompt pattern

## BB4 — No clock modal (multi-timezone display)

1. No clock modal showing multiple timezone clocks simultaneously
2. Web has a clock modal (triggered by 'L' key) that displays configured world clocks
3. No world clock display anywhere in the app

## BB5 — Sidebar: no logo, no Audit Log link, no Custom Objects link

1. The app's navigation drawer/sidebar has no CWOC logo
2. No link to Audit Log (page doesn't exist — see Z1)
3. No link to Custom Objects editor (page doesn't exist — see Z2)
4. No link to Rules Manager (page doesn't exist — see Z3)
5. No link to User Admin (page doesn't exist — see Z4)
6. Web sidebar has: logo, all C CAPTN tabs, Weather, Maps, People, Help, Settings, Audit Log, Custom Objects, Trash, and admin-only links


## CC1 — Email dashboard tab (inbox list view with cards)

1. No Email tab in the app's bottom navigation or drawer
2. Web has a full Email tab showing inbox emails as cards with sender, subject, preview, date, read/unread state
3. No email list view of any kind

## CC2 — Email thread view (grouped by conversation)

1. No thread/conversation grouping for emails
2. Web groups emails by thread (subject + references) and shows them as expandable conversations
3. No thread UI

## CC3 — Email compose (new draft creation from dashboard)

1. No "Compose" button to create a new email from the email tab
2. Web has a compose button that creates a new email chit in draft state
3. Email composition only possible by creating a chit and activating the email zone manually

## CC4 — Email read/unread toggle

1. No read/unread state toggle on email cards
2. Web has a read/unread toggle (click to mark read, click again to mark unread)
3. No visual distinction between read and unread emails

## CC5 — Email quick-archive with undo

1. No quick-archive action on email cards
2. Web has a swipe or button to archive emails with an undo toast
3. No archive action specific to emails

## CC6 — Email quick-delete with undo

1. No quick-delete action on email cards
2. Web has a swipe or button to delete emails with an undo toast
3. No delete action specific to emails

## CC7 — Email sub-filters (inbox/by-tag/drafts/trash)

1. No email-specific filter tabs (Inbox, By Tag, Drafts, Trash)
2. Web has sub-filter tabs within the Email view for different email states
3. No email state filtering

## CC8 — Email bundles (tabs, toolbar, drag-reorder, create/edit/delete)

1. No email bundle system (grouping emails into custom categories)
2. Web has a full bundle system with: bundle tabs, create/edit/delete bundles, drag-reorder tabs, color-coded tabs, rule-based auto-sorting
3. No bundle UI or configuration

## CC9 — Email "Check Mail" button (trigger IMAP sync)

1. No "Check Mail" button to manually trigger email sync
2. Web has a button that triggers an IMAP fetch for new emails
3. No manual email sync trigger

## CC10 — Email unread count badge on tab

1. No unread email count badge on any navigation element
2. Web shows an unread count badge on the Email tab
3. No email count indicator anywhere

## CC11 — Email bulk actions (select all, bulk read/unread)

1. No multi-select capability on email cards
2. No "Select All" checkbox
3. No bulk mark-as-read or mark-as-unread actions
4. Web has full bulk action support with shift+click range selection

## CC12 — Email tracking detection (UPS/USPS/FedEx/flight numbers)

1. No automatic detection of tracking numbers in email content
2. Web detects shipping tracking numbers (UPS, USPS, FedEx) and flight numbers, displaying them as actionable links
3. No tracking number parsing or display

## CC13 — Email nested chits in threads (non-email chits nested into threads)

1. No ability to nest non-email chits into email threads
2. Web allows nesting any chit into an email thread for context
3. No thread nesting UI

## CC14 — Email contact image lookup on cards

1. No contact profile images on email cards
2. Web looks up the sender's contact record and displays their profile image on email cards
3. No sender avatar display

## CC15 — Email shift+click range selection

1. No range selection gesture for emails
2. Web supports shift+click to select a range of emails for bulk actions
3. No multi-select of any kind

## CC16 — Email settings tab (accounts, IMAP/SMTP config, privacy settings)

1. No email settings configuration (see W2)
2. Web has a full Email settings tab with account configuration, IMAP/SMTP server details, privacy settings, signature
3. No email account setup anywhere in the app


---

## ADDITIONAL GAPS DISCOVERED DURING AUDIT (not in original remediation plan)

These are functional gaps found by comparing the web and Android implementations that were not explicitly called out in the original remediation plan.

## ADD1 — Editor: No "Hide in Calendar" option

1. Web Options menu has "Hide in Calendar" toggle — not present in Android Options menu
2. No way to hide a chit from calendar views without removing its dates

## ADD2 — Editor: No "Mark as Reminder" option

1. Web Options menu has "Mark as Reminder" toggle — not present in Android Options menu
2. No reminder flag toggle

## ADD3 — Editor: No "Nest into Thread" option

1. Web Options menu has "Nest into Thread" — not present in Android Options menu
2. No thread nesting capability from the editor options
3. The nest thread label exists in TitleMetadataRow but there's no way to set/change it

## ADD4 — Editor: No "Audit Log" option

1. Web Options menu has "Audit Log" that shows change history for this chit — not present in Android
2. No per-chit audit log viewer

## ADD5 — Editor: No "Make Email" option

1. Web Options menu has "Make Email" that activates the email zone — not present in Android Options menu
2. No quick way to convert a regular chit into an email chit from the options menu

## ADD6 — Editor: No "Print Chit" option

1. Web Options menu has "Print Chit" with a "Hide ✓" checkbox — not present in Android
2. No print capability (though this may be less relevant on mobile)

## ADD7 — Editor: No Archive option in Options menu

1. Web Options menu has "Archive" toggle — Android has Archive in the TopAppBar but not in the Options dropdown
2. The functionality exists but is in a different location

## ADD8 — Editor: Mobile zone navigation (one zone at a time)

1. Web's `editor-mobile-zones.js` implements a mobile-specific UI where only one zone is visible at a time with navigation buttons to switch between zones
2. Android editor shows ALL zones in a single scrollable column — no zone-by-zone navigation
3. On mobile web, there are Previous/Next zone buttons and a zone selector — this pattern doesn't exist on Android
4. This is a CORE structural difference in how the editor works on mobile

## ADD9 — No Omni View configuration

1. OmniView screen exists in navigation but its configuration (which columns to show, sort order) is not in settings
2. Web has Omni View settings for customizing the combined view

## ADD10 — No calculator modal

1. Web has a calculator modal (triggered by F4 key) — no equivalent in Android
2. No calculator functionality anywhere in the app

## ADD11 — No quick-alert creation from dashboard

1. Web has a "!" hotkey that opens a quick-alert creation panel (Reminder/Alarm/Timer/Stopwatch)
2. No equivalent quick-create for alerts from the main navigation — must open editor first

## ADD12 — Calendar: No "Work Hours" view mode

1. Web has a "Work Hours" (K) calendar mode that shows only working hours (e.g., 8am-6pm)
2. Android CalendarViewMode enum has no WORK_HOURS entry
3. No way to view only working hours in the calendar

## ADD13 — No weather page integration with calendar

1. Weather screen exists but doesn't integrate with calendar views
2. Web shows weather data in calendar day headers and on event cards with locations
3. No weather-calendar cross-reference

## ADD14 — Editor: Color palette doesn't match web

1. Android ColorZone uses 15 colors: #FF6B6B, #FF8E53, #FFC93C, #6BCB77, #4D96FF, #9B59B6, #E91E63, #00BCD4, #8BC34A, #FF5722, #795548, #607D8B, #F44336, #2196F3, #4CAF50
2. Web uses 7 default colors: transparent, #C66B6B, #D68A59, #E3B23C, #8A9A5B, #6B8299, #8B6B99
3. The color palettes are completely different — a chit colored on web will show a different swatch selected on Android
4. No "transparent" (no color) swatch with ☒ icon — Android uses a "Clear" chip instead

## ADD15 — No "Send to another chit" for notes content

1. Notes zone has a "Send" AssistChip that opens Android share sheet (external sharing)
2. Web's "Send to another chit" opens a chit picker and transfers the note content to another chit's notes field
3. The Android "Send" is external sharing, not internal chit-to-chit transfer

## ADD16 — Editor: No "Copy to clipboard" for notes with toast feedback

1. Notes zone has a "Copy" AssistChip that copies to clipboard
2. However, no toast/snackbar feedback confirming the copy succeeded
3. Web shows a `cwocToast` confirmation after copying

## ADD17 — No saved locations dropdown in Location zone header

1. Web has a "Saved Locations" dropdown in the Location zone that lets you pick from pre-configured locations
2. Android has a "Saved Locations" AssistChip that opens a DropdownMenu — this IS implemented
3. However, the web also has a "Directions" button in the zone header — Android has this too
4. This gap may be partially resolved — verify saved locations actually populate from settings

## ADD18 — Editor zones don't show one at a time on mobile

1. This is the same as ADD8 but bears repeating: the web mobile experience shows ONE zone at a time with Previous/Next navigation
2. The Android editor is a single long scroll — all zones visible simultaneously
3. This fundamentally changes the editing experience on a phone-sized screen
4. Zone navigation buttons (Previous Zone / Next Zone) don't exist
5. No zone selector/picker to jump to a specific zone


---

## SUMMARY

| Section | Gap Count | Sub-items |
|---------|-----------|-----------|
| A (Visual Identity) | 5 | 19 |
| B (Card Rendering) | 14 | 42 |
| C (Calendar) | 12 | 38 |
| D (Notes View) | 7 | 16 |
| E (Editor Dates) | 6 | 12 |
| F (Editor Task) | 4 | 8 |
| G (Editor Habits) | 6 | 14 |
| H (Editor Location) | 6 | 12 |
| I (Editor Tags) | 3 | 9 |
| J (Editor Notes) | 6 | 14 |
| K (Editor Checklist) | 3 | 7 |
| L (Editor Alerts) | 7 | 18 |
| M (Editor People) | 5 | 12 |
| N (Editor Projects) | 5 | 14 |
| O (Editor Other) | 10 | 33 |
| P (Editor Header) | 2 | 4 |
| Q (Projects/Kanban) | 7 | 16 |
| R (Alerts View) | 8 | 18 |
| S (Indicators View) | 3 | 6 |
| T (Maps) | 3 | 7 |
| U (Search) | 3 | 6 |
| V (Filters & Sort) | 6 | 12 |
| W (Settings) | 4 | 30+ |
| X (Contact Editor) | 12 | 24 |
| Y (Conflicts) | 4 | 8 |
| Z (Missing Pages) | 8 | 16 |
| AA (Widgets) | 1 | 7 |
| BB (Miscellaneous) | 5 | 14 |
| CC (Email Client) | 16 | 32 |
| ADD (Newly Discovered) | 18 | 40+ |
| **TOTAL** | **~202** | **~500+** |

