# Release 20260513.2018

Fixed "Authentication required" error when clicking the Raw Email download button — switched from `window.open` (which can fail to send session cookies) to a `fetch`-based blob download that properly includes credentials.
