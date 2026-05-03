## CWOC Release 20260502.1809

Fixed Tailscale "Open App" button on Android — Tailscale doesn't register a custom `tailscale://` URL scheme on Android, so the button now uses an `intent://` URI targeting the app's main activity by package name (`com.tailscale.ipn`), with a Play Store fallback if the app isn't installed.
