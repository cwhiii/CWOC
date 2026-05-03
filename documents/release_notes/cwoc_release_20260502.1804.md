## CWOC Release 20260502.1804

Fixed Tailscale "Open App" deep link not launching the app on Android Firefox — switched from a plain `<a href="tailscale://">` anchor to an `intent://` URI with the correct package name (`com.tailscale.ipn`), matching the approach already used by the ntfy button.
