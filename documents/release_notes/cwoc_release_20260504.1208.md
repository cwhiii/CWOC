# CWOC Release 20260504.1208 — Rules Engine Fixes

Fixed critical bug where rules engine triggers never fired. The `dispatch_trigger` function was async but called from synchronous FastAPI endpoints via `asyncio.get_event_loop().create_task()`, which silently fails from threadpool threads. Converted to synchronous function with `threading.Thread` for fire-and-forget execution. Added comprehensive logging throughout the dispatch pipeline. Moved rule editor save buttons to the header bar matching the chit editor pattern.
