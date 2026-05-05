# Release 20260505.1001

- Add-to-project modal now shows tags as inline badges next to each chit title
- Search matches are highlighted (title, tags, status) using `<mark>` just like global search
- Tag-only search with `#` prefix now works correctly (strips the # before matching)
- Unified search logic via shared `chitMatchesSearch()` function (dashboard + project modal)
