# Release 20260514.0708

Fixed WebSocket sync dropping connection and permanently falling back to HTTP polling. Added server-side keepalive pings every 30 seconds to prevent nginx/browser idle timeouts, client-side pong responses, retry logic (up to 3 attempts) before falling back to polling, and automatic WebSocket upgrade attempts when the tab regains focus.
