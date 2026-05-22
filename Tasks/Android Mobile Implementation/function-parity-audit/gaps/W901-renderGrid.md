# W901: renderGrid(wrap)

## What the web function does
Renders a grid of attachment cards into a container element. Each card contains:
- A checkbox for multi-select
- A thumbnail (actual image for image types, or a file-type emoji icon for non-images)
- The filename (with title tooltip)
- The file size (formatted)
- The parent chit title as a clickable link to the chit editor
- Click behavior: Ctrl/Meta/Shift click for multi-select, plain click opens preview modal

## What exists on Android
A#801 `AttachmentsScreen` uses a `LazyVerticalGrid` (2 columns) with A#800 `AttachmentCard` composables. Each card has:
- Thumbnail (AsyncImage for images, Material icon for other types)
- Checkbox overlay in multi-select mode
- Filename
- File size
- Date created
- Click → preview, long-click → enter multi-select mode

## What's missing
- **Parent chit title is not displayed on the card.** The web shows the chit title as a clickable link to the editor on each attachment card. The Android card shows the creation date instead. The `AttachmentItem` data class doesn't even have a `chit_title` field — the API response would need to include it, and the card UI would need to display it (ideally tappable to navigate to the chit editor).
