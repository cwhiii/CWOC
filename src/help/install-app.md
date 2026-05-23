# Install as App

- [Native Android App (Recommended)](#native-android-app-recommended)
- [Trusting the Server Certificate](#trusting-the-server-certificate)
- [Installing on Desktop (Chrome, Edge)](#installing-on-desktop-chrome-edge)
- [Installing on Android — Firefox](#installing-on-android-firefox)
- [Installing on Android — Chrome](#installing-on-android-chrome)
- [Installing on iOS (Safari)](#installing-on-ios-safari)
- [Push Notifications](#push-notifications)
- [Offline](#offline)


CWOC is available as a native Android app and as a Progressive Web App (PWA). The native app is recommended for Android users — it provides offline sync, push notifications, and a full native experience. The PWA option works on all platforms and runs in its own window without browser chrome.

## Native Android App (Recommended)

A native Android app is available for sideloading. This is a full Kotlin/Compose client — not a browser wrapper — with offline support, bidirectional sync, and push notifications.

1. On your Android device, open your browser and navigate to your CWOC server's install directory: `https://your-server-ip/static/install/cwoc_android_app.apk` (or download it from the `install/` folder in your CWOC deployment).
2. Open the downloaded APK file. If prompted, enable **"Install from unknown sources"** for your browser in Android Settings → Apps → Special access → Install unknown apps.
3. Tap **Install** and open the app.
4. On first launch, enter your CWOC server URL (e.g., `https://192.168.1.111`) and sign in with your username and password.

The app syncs automatically in the background. Changes made on the app appear on the web and vice versa.

## PWA (Browser Install)

The sections below cover installing CWOC as a Progressive Web App from your browser. This works on all platforms (desktop, Android, iOS) but does not have the full offline sync capabilities of the native Android app.

## Trusting the Server Certificate

If your CWOC server uses a self-signed SSL certificate (the default), your device won't trust it out of the box. You need to install the server's CA certificate on your device first.

1. Go to **[Settings → 📱 Install as App](/frontend/html/settings.html#install-app)** and tap **"📜 Download Server Certificate"**. This downloads the CA certificate that signed your server's SSL cert.
2. Install the downloaded certificate on your device:
   - **Android:** Open the downloaded file. Go to Settings → Security → Encryption & credentials → Install a certificate → CA certificate. Accept the warning. This is a one-time setup per device.
   - **iOS:** Open the downloaded file → Settings → Profile Downloaded → Install. Then go to Settings → General → About → Certificate Trust Settings and enable full trust for the "CWOC Local CA" certificate.
3. After installing the cert, **close and reopen your browser completely** (swipe it away from the app switcher). The certificate warning should be gone when you revisit CWOC.

## Installing on Desktop (Chrome, Edge)

- Go to **[Settings → 📱 Install as App](/frontend/html/settings.html#install-app)**. If your browser supports direct install, a **"📲 Install CWOC App"** button will appear — click it and confirm.
- Alternatively, click the install icon in the browser address bar (usually a ⊕ or monitor icon on the right side).
- Once installed, CWOC appears in your app launcher and opens in its own window.

## Installing on Android — Firefox

- Firefox on Android cannot install standalone PWAs — its "Add to Home Screen" only creates a bookmark that opens in a regular Firefox tab.
- To get a real standalone app, go to **[Settings → 📱 Install as App](/frontend/html/settings.html#install-app)** and tap **"🌐 Open in Chrome to Install"**. This launches Chrome directly to your CWOC server.
- In Chrome, tap the menu (⋮) → **"Add to Home screen"** or **"Install app"**. The installed app runs independently — you don't need to use Chrome for anything else.
- Chrome must be installed on your device (it comes pre-installed on most Android phones).

## Installing on Android — Chrome

- Go to **[Settings → 📱 Install as App](/frontend/html/settings.html#install-app)** and tap **"📲 Install CWOC App"** if the button appears.
- Or tap the browser menu (⋮) and select **"Add to Home screen"** or **"Install app"**.
- CWOC will appear on your home screen with the CWOC icon.

## Installing on iOS (Safari)

- Tap the **Share** button (the square with an arrow) and select **"Add to Home Screen"**.
- CWOC will appear on your home screen and launch in standalone mode.

## Push Notifications

When installed as an app, CWOC can send push notifications for chit alarms and due dates even when the app tab is closed. Grant notification permission when prompted to enable this. The server sends push notifications when a chit's alarm, start time, or due time arrives — tapping the notification opens the chit in the editor.

## Offline

Pages you've visited are cached for faster loading. If you open CWOC without a network connection and the page isn't cached, a friendly offline message appears with a retry button. CWOC requires a network connection for full functionality since data is stored on the server.

---

**See also:** [Ntfy Notifications](/frontend/html/help.html#ntfy-notifications) · [Settings](/frontend/html/settings.html)
