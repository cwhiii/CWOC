# W36: initPrerequisites(chit)

## What the web function does
1. Loads prerequisite chit IDs from `chit.prerequisites` array
2. Fetches full chit data for each prerequisite (title, status, color)
3. Renders a list showing: chit color background, title, inline status dropdown (can change status from here), remove button
4. Supports opening a chit picker to add new prerequisites
5. Shows auto-block warning when prerequisites are incomplete

## What exists on Android
`PrerequisitesZone` composable in ChitEditorScreen.kt (line 898):
- Takes `prerequisites: List<String>?` 
- Renders InputChips showing truncated chit IDs (`prereqId.take(8) + "…"`)
- Has remove button on each chip
- Has text field to add new prerequisite by ID
- Shows count in collapsed state

## What's missing
1. **No chit title/status display** — shows raw IDs instead of fetching and displaying chit titles and statuses
2. **No chit picker** — requires manual ID entry instead of a searchable picker (web uses `cwocChitPickerModal`)
3. **No inline status change** — web allows changing a prerequisite's status directly from the list
4. **No color background** — web shows each prerequisite with its chit color
5. **No auto-block logic** — web's `_checkPrereqAutoBlock()` automatically sets status to Blocked when prerequisites are incomplete

## Fix needed
- Fetch chit data for each prerequisite ID to display title + status
- Replace text input with ChitPickerSheet for adding prerequisites
- Add color background to chips
- Implement auto-block logic (W42)
