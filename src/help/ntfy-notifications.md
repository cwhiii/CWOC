# Ntfy Notifications

Ntfy is a lightweight push notification service that delivers alerts to your phone even when the browser is closed. CWOC runs its own Ntfy server alongside the main app — no third-party services needed. Notifications work for chit alarms, start times, and due dates.

## Setup (One-Time)

1. **Enable Ntfy on the server** — Go to **[Settings](/frontend/html/settings.html) → Dependent Apps → Ntfy** (admin only). Expand the Ntfy section and check that the status shows 🟢 Active. Click **💾 Save Config** if not already enabled.
2. **Note your Topic and Server URL** — In the same section, your auto-generated Topic (e.g., `cwoc-a1b2c3d4e5f6`) and Server URL (e.g., `http://192.168.1.111:2586`) are displayed. You'll need both for the next step.
3. **Install the Ntfy app on your phone**
   - **Android:** Search "ntfy" on the Google Play Store or F-Droid
   - **iOS:** Search "ntfy" on the App Store
4. **Subscribe to your Topic** — Open the Ntfy app, tap **+** to add a subscription:
   - **Topic:** Enter your Topic exactly as shown in Settings (e.g., `cwoc-a1b2c3d4e5f6`)
   - **Server URL:** Enter the Server URL shown in Settings — use the **local IP** with port 2586 (e.g., `http://192.168.1.111:2586`)
   - **Important:** Only add **one** subscription. Do not add a second subscription for the Tailscale IP — that would cause duplicate notifications. The single local-IP subscription works both at home and remotely (see below).
5. **Enable Instant Delivery** — In the Ntfy app, tap your subscription, then enable **Instant Delivery**. This keeps a persistent connection so notifications arrive immediately.
6. **Test it** — Back in CWOC [Settings](/frontend/html/settings.html) → Ntfy, click the **🔔 Test** button. You should see a notification on your phone within seconds.

## How It Works at Home vs. Away

You only need **one subscription** using the server's local IP (e.g., `http://192.168.1.111:2586`). This works in both scenarios:

- **At home (WiFi)** — Your phone connects directly to the server on the local network. Tailscale is not needed.
- **Away from home** — Turn on Tailscale on your phone. Because the CWOC server advertises its local subnet through Tailscale (subnet routing), your phone can still reach `192.168.1.111` through the Tailscale tunnel. The same Ntfy subscription works without any changes.

When Tailscale is off and you're away from home, notifications won't arrive until you reconnect (either by returning home or turning Tailscale on).

## Tailscale Subnet Routing (Required for Remote Access)

For notifications to work when you're away from home, the CWOC server must advertise its local network through Tailscale. This is set up automatically by the configurator, but you need to approve it once:

1. Go to [login.tailscale.com/admin/machines](https://login.tailscale.com/admin/machines)
2. Find your CWOC server in the list (e.g., "zamonia")
3. Click the **⋯** menu → **Edit route settings**
4. Enable the subnet route (e.g., `192.168.1.0/24`)

This is a one-time step. After approval, any device on your Tailscale network can reach your home server's local IP through the tunnel.

## What Gets Notified

Ntfy sends notifications for chit start times, due times, and alarms. Each notification shows the chit title and the time that triggered it. Tapping a notification opens the chit in the editor.

## Troubleshooting

- **Status shows 🔴 or ⚪** — The Ntfy service may not be installed or may have stopped. On the server, run `systemctl status ntfy` to check.
- **Wrong Server URL** — The URL in the Ntfy app must use port **2586** (not the CWOC port 443 or 3333) and start with `http://`, not `https://`.
- **Topic mismatch** — The Topic in the Ntfy app must exactly match the one shown in Settings. Topics are case-sensitive.
- **Duplicate notifications** — You probably have two subscriptions in the Ntfy app (local IP and Tailscale IP). Delete one — you only need the local IP subscription.
- **Works at home but not remotely** — Make sure Tailscale is running on both the server and your phone. Check that subnet routing is approved in the Tailscale admin console (see above).
- **Notifications delayed** — Enable Instant Delivery in the Ntfy app for your subscription. Also check that Android isn't killing the Ntfy app — add it to your battery optimization exceptions (Settings → Apps → Ntfy → Battery → Unrestricted).

---

**See also:** [Dependent Apps](/frontend/html/help.html#dependent-apps) · [Settings](/frontend/html/settings.html) · [Install as App](/frontend/html/help.html#install-app)
