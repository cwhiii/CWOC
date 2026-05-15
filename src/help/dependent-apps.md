# Dependent Apps

- [Tailscale](#tailscale)
- [Troubleshooting](#troubleshooting)


The Settings page includes a **📱 Dependent Apps** block (admin only) for configuring external services that CWOC integrates with. Currently supports Tailscale (mesh VPN for secure remote access) and Ntfy (push notifications to your phone).

## Tailscale

- **Status** — Shows the current Tailscale state: ⚪ Not Installed, 🟡 Inactive, 🟢 Connected (with IP and hostname), or 🔴 Error. Click 🔄 Check Status to re-check (read-only — does not attempt to reconnect).
- **Auth Key** — Enter your Tailscale pre-authentication key (from the Tailscale admin console). The key is masked by default; click 👁️ to reveal it. Click 🔑 Get Key to open the Tailscale admin console.
- **Enabled** — Toggle whether Tailscale should be active.
- **💾 Save Config** — Saves the auth key and enabled state immediately (independent of the main settings Save button). If the auth key changes, Tailscale is automatically disconnected and logged out so the old credentials are purged.
- **▶️ Connect** — Authenticates and connects Tailscale using the saved auth key. Forces re-authentication each time.
- **⏹️ Disconnect** — Stops the Tailscale connection.

## Troubleshooting

- **TUN device missing** — If you see "TUN device not available (/dev/net/tun missing)", your server is likely running in a Proxmox LXC container that doesn't have TUN access enabled. Add TUN device access to the container config on the Proxmox host.
- **Daemon won't start** — Check the server logs with `journalctl -xeu tailscaled.service` for details.
- **Auth key expired** — One-time keys can only be used once. Generate a new key from the Tailscale admin console and save it.

---

**See also:** [Settings](/frontend/html/settings.html) · [Ntfy Notifications](/frontend/html/help.html#ntfy-notifications) · [Install as App](/frontend/html/help.html#install-app)
