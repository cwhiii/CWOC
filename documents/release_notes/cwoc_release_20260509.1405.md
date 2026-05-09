Fixed 405 "Method Not Allowed" error when creating new chits — the `create_chit()` function was missing its `@router.post("/api/chits")` route decorator.
