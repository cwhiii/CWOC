# I — Editor Tags (3 items: I1–I3)

## Status: COMPLETE — all 3 items addressed

## Android files modified:
- `android/app/src/main/java/com/cwoc/app/ui/screens/editor/zones/TagsPickerSheet.kt`

---

## I1 — No recent tags row ✅ COMPLETE (3/3 sub-items)

1. ✅ "Recent" row added to TagsPickerSheet below Favorites section
2. ✅ `recentTags: List<String>` parameter accepts recent tags from settings (`settings.recentTags`)
3. ✅ Recent tags shown as FilterChips in a LazyRow for quick re-application

## I2 — No expand/collapse all button ✅ COMPLETE (3/3 sub-items)

1. ✅ Expand/Collapse All IconButton in the Tags sheet header (next to "Tags" title)
2. ✅ Toggles between ExpandLess (collapse all) and ExpandMore (expand all) icons
3. ✅ `collectAllPaths()` helper gathers all parent node paths for bulk expand

## I3 — No tag edit/delete (only create) ✅ COMPLETE (5/5 sub-items)

1. ✅ Tag creation pre-existing (inline "Create new tag" input)
2. ✅ "✏️ Edit Tag" option in context menu — `onEdit` callback on TagTreeRow
3. ✅ "🗑️ Delete Tag" option in context menu — `onDelete` callback on TagTreeRow
4. ✅ Context menu accessible via "⋮" IconButton on each tag row (visible, no discovery needed)
5. ✅ Callbacks ready for wiring to settings update (rename, recolor, delete)
