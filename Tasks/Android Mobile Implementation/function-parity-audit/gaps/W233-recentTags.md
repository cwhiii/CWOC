# W233-235: Recent Tags

## What the web functions do
W233-235 manage a "recent tags" feature:
- Tracking which tags the user has recently applied to chits
- Displaying recent tags as quick-access chips in the tag picker
- Persisting recent tags list (localStorage or settings)

## What exists on Android
- `RecentTagsManager` in domain/tags/ tracks recent tags
- `ChitEditorViewModel.recentTags` StateFlow
- `TagsPickerSheet` receives `recentTags` prop
- Recent tags ARE displayed in the TagsPickerSheet

## What's missing
Based on the ❌ Missing status from the earlier audit, these were marked missing. However, looking at the Android code NOW, `RecentTagsManager` and the TagsPickerSheet recent tags display exist. This may need re-verification.

**Recommendation:** Re-verify W233-235 against the current Android codebase. The RecentTagsManager appears to implement this feature now.
