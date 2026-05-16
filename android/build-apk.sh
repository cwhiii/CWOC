#!/bin/bash
# Build APK from command line and capture all output (including errors) to build-output.txt
# Usage: cd to android/ dir and run: bash build-apk.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Generate gradlew if it doesn't exist
if [ ! -f "./gradlew" ]; then
    echo "gradlew not found — generating wrapper..."
    GRADLE_BIN=$(find /opt/android-studio -name "gradle" -type f 2>/dev/null | grep "bin/gradle" | head -1)
    if [ -z "$GRADLE_BIN" ]; then
        GRADLE_BIN=$(find /snap -name "gradle" -type f 2>/dev/null | grep "bin/gradle" | head -1)
    fi
    if [ -z "$GRADLE_BIN" ]; then
        GRADLE_BIN=$(find /usr/local -name "gradle" -type f 2>/dev/null | grep "bin/gradle" | head -1)
    fi
    if [ -z "$GRADLE_BIN" ]; then
        GRADLE_BIN=$(which gradle 2>/dev/null)
    fi
    if [ -z "$GRADLE_BIN" ]; then
        # Try Android Studio's bundled Gradle via ANDROID_STUDIO_DIR
        for dir in /opt/android-studio /usr/local/android-studio ~/android-studio; do
            if [ -d "$dir" ]; then
                GRADLE_BIN=$(find "$dir" -path "*/bin/gradle" -type f 2>/dev/null | head -1)
                [ -n "$GRADLE_BIN" ] && break
            fi
        done
    fi
    if [ -z "$GRADLE_BIN" ]; then
        echo "ERROR: Cannot find gradle binary anywhere."
        echo "Looked in: /opt/android-studio, /snap, /usr/local, PATH"
        echo "Install gradle (dnf install gradle) or locate your Android Studio installation."
        exit 1
    fi
    echo "Found gradle at: $GRADLE_BIN"
    "$GRADLE_BIN" wrapper
    chmod +x ./gradlew
fi

# Set ANDROID_HOME if not set (common Fedora locations)
if [ -z "$ANDROID_HOME" ]; then
    for sdk_dir in ~/Android/Sdk ~/android-sdk /opt/android-sdk; do
        if [ -d "$sdk_dir" ]; then
            export ANDROID_HOME="$sdk_dir"
            break
        fi
    done
fi

# Set JAVA_HOME if not set
if [ -z "$JAVA_HOME" ]; then
    JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java) 2>/dev/null) 2>/dev/null) 2>/dev/null)
    export JAVA_HOME
fi

# Clean and build, capturing ALL output
echo "Building APK (clean + assembleDebug)..."
echo "ANDROID_HOME=$ANDROID_HOME"
echo "JAVA_HOME=$JAVA_HOME"
echo ""
./gradlew clean assembleDebug 2>&1 | tee build-output.txt

echo ""
echo "=== Build complete. Output saved to build-output.txt ==="
