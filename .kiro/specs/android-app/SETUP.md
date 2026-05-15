# Android Studio Setup on Fedora

## 1. Install Prerequisites

```bash
# Required system packages for Android Studio and the emulator
sudo dnf install -y java-17-openjdk java-17-openjdk-devel \
    unzip wget git \
    zlib-devel ncurses-libs bzip2-libs \
    libstdc++ libX11 libXrender libXext mesa-libGL

# KVM for hardware-accelerated emulator (optional but strongly recommended)
sudo dnf install -y @virtualization
sudo systemctl enable --now libvirtd
sudo usermod -aG kvm $USER
```

Log out and back in after the `usermod` command so the `kvm` group takes effect.

## 2. Download Android Studio

```bash
# Download the latest stable tarball
cd ~/Downloads
wget https://redirector.gvt1.com/edgedl/android/studio/ide-zips/2024.2.2.13/android-studio-2024.2.2.13-linux.tar.gz

# Extract to /opt
sudo tar -xzf android-studio-*.tar.gz -C /opt/

# Create a symlink for easy launching
sudo ln -sf /opt/android-studio/bin/studio.sh /usr/local/bin/android-studio
```

If that download URL is stale, grab the latest from [developer.android.com/studio](https://developer.android.com/studio) — click "Download Android Studio" and pick the `.tar.gz` for Linux.

## 3. Launch Android Studio & Run Setup Wizard

```bash
android-studio
```

On first launch:
1. **Import settings** → "Do not import settings"
2. **Setup Wizard** → Standard install
3. It will download: Android SDK, SDK Platform 34, Build Tools, Emulator, Platform Tools
4. Accept all licenses when prompted
5. Wait for downloads to finish (~2-3 GB)

## 4. Set Environment Variables

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools:$ANDROID_HOME/tools/bin
```

Then reload:
```bash
source ~/.bashrc
```

## 5. Open the CWOC Project

1. In Android Studio: **File → Open**
2. Navigate to your CWOC project and select the `android/` directory
3. Click **OK**
4. Wait for Gradle sync to complete (first time takes a few minutes — downloads all dependencies declared in `build.gradle.kts`)

If Gradle sync fails with a JDK error:
- Go to **File → Settings → Build → Gradle**
- Set "Gradle JDK" to the bundled JDK 17 (or your system `java-17-openjdk`)

## 6. Create an Emulator (or Use Your Phone)

### Option A: Emulator

1. **Tools → Device Manager → Create Virtual Device**
2. Pick a phone (Pixel 7 is a good default)
3. Select system image: **API 34** (download if needed)
4. Finish — the emulator appears in the device list

### Option B: Physical Device (Sideload)

1. On your Android phone: **Settings → About Phone → tap "Build Number" 7 times** (enables Developer Options)
2. **Settings → Developer Options → Enable USB Debugging**
3. Connect phone via USB
4. Accept the "Allow USB debugging?" prompt on the phone
5. The device appears in Android Studio's device dropdown

## 7. Build & Run

1. Select your device/emulator from the dropdown in the toolbar
2. Click the green **Run ▶** button (or `Shift+F10`)
3. First build takes 2-5 minutes (compiles everything, generates Hilt/Room code)
4. The app installs and launches — you'll see the login screen

## 8. Build an APK for Sideloading

If you just want the APK without running from the IDE:

```bash
cd /path/to/CWOC/android
./gradlew assembleDebug
```

The APK lands at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Transfer it to your phone (USB, email, cloud drive) and install. You'll need "Install from unknown sources" enabled for your file manager.

## 9. Desktop Shortcut (Optional)

```bash
cat > ~/.local/share/applications/android-studio.desktop << 'EOF'
[Desktop Entry]
Name=Android Studio
Exec=/opt/android-studio/bin/studio.sh
Icon=/opt/android-studio/bin/studio.svg
Type=Application
Categories=Development;IDE;
EOF
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Emulator won't start / "KVM not found" | Verify `ls /dev/kvm` exists and your user is in the `kvm` group (`groups $USER`) |
| Gradle sync fails with "SDK not found" | Set `sdk.dir` in `android/local.properties`: `sdk.dir=/home/youruser/Android/Sdk` |
| "AAPT2 error" on first build | Run **File → Invalidate Caches → Restart** |
| Emulator is slow | Ensure KVM is working (`egrep -c '(vmx|svm)' /proc/cpuinfo` should be > 0) |
| "Could not resolve com.google.dagger:hilt-android" | Check internet connection; Gradle needs to download dependencies on first sync |
