# Release 20260505.1345

Admin Chit Manager now uses the same boolean search engine as global search (supports #tags, &&, ||, !, parentheses). Added status filter dropdown, "No Status" filter option, bulk Set Priority action, and increased result limit to 1000. Search logic extracted into shared `_search_filter_chits()` function in chits.py — no code duplication.
