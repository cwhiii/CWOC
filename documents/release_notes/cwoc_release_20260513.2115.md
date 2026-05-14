# Release 20260513.2115

Fixed performance regression from cache check. The spinner condition was re-parsing the full chit cache JSON on every fetchChits() call. Replaced with a cheap boolean flag that gets set once on first cache load/save.
