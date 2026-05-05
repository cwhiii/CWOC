# Release 20260505.1028

Fixed browser authentication popup (username/password dialog) appearing when navigating back to the dashboard. Added a middleware layer that strips the WWW-Authenticate header from all 401 responses, preventing the browser from showing its built-in auth challenge regardless of which code path generates the 401.
