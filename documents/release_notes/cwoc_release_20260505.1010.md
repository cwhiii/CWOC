# Release 20260505.1010

- Fixed child chits not appearing in the project zone after adding — caused by case-sensitive status matching ("todo" vs "ToDo"). Status is now normalized on add and matched case-insensitively during render.
- Add-to-project modal: Status and Priority filter dropdowns are now functional (case-insensitive matching)
- Modal is wider (900px max) to avoid horizontal scrolling
- Tags shown as inline badges with search highlighting
- `#tag` search prefix works correctly
