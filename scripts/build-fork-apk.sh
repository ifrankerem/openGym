#!/usr/bin/env bash
# Build this fork's signed Android APK (issue #4): it installs beside the official openGym
# under its own id and name, and checks this fork's GitHub releases for updates.
#
#   ./scripts/build-fork-apk.sh
#
# Needs a JDK (JAVA_HOME, default ~/Android/jdk21), the Android SDK (ANDROID_HOME, default
# ~/Android/Sdk) and a keystore. Signing secrets are read from a file and never echoed:
#   OPENGYM_KEYSTORE         keystore path   (default ~/.local/share/opengym-fork/opengym-fork.keystore)
#   OPENGYM_KEY_ALIAS        key alias       (default opengym-fork)
#   OPENGYM_KEYSTORE_PASS_FILE  file holding the store and key password (default ~/.local/share/opengym-fork/keystore.pass)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
KEYSTORE="${OPENGYM_KEYSTORE:-$HOME/.local/share/opengym-fork/opengym-fork.keystore}"
KEY_ALIAS="${OPENGYM_KEY_ALIAS:-opengym-fork}"
PASS_FILE="${OPENGYM_KEYSTORE_PASS_FILE:-$HOME/.local/share/opengym-fork/keystore.pass}"
OUT_DIR="$ROOT/dist-apk"

# Everything missing is reported before a ten-minute build, not after it.
for required in "$KEYSTORE" "$PASS_FILE"; do
  if [ ! -f "$required" ]; then
    echo "Missing $required." >&2
    echo "Create the fork signing key first (see the fork README), or point OPENGYM_KEYSTORE / OPENGYM_KEYSTORE_PASS_FILE at an existing one." >&2
    exit 1
  fi
done

export JAVA_HOME="${JAVA_HOME:-$HOME/Android/jdk21}"
SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [ ! -d "$SDK/build-tools" ]; then
  echo "No build-tools under $SDK — set ANDROID_HOME to an Android SDK." >&2
  exit 1
fi
BUILD_TOOLS="$SDK/build-tools/$(ls -1 "$SDK/build-tools" | sort -V | tail -1)"
ZIPALIGN="$BUILD_TOOLS/zipalign"
APKSIGNER="$BUILD_TOOLS/apksigner"
# Gradle reads the SDK from the environment; an unset ANDROID_HOME otherwise fails the build
# with "SDK location not found".
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"

# The bundle asks this fork's releases for updates (VITE_UPDATE_REPO, lib/update.js).
cd "$FRONTEND"
VITE_UPDATE_REPO=ifrankerem/openGym npm run build:mobile

cd "$FRONTEND/android"
./gradlew assembleFork --no-daemon

UNSIGNED="$FRONTEND/android/app/build/outputs/apk/fork/app-fork-unsigned.apk"
if [ ! -f "$UNSIGNED" ]; then
  echo "Gradle finished but $UNSIGNED is missing." >&2
  exit 1
fi

VERSION="$(node -p "require('$FRONTEND/package.json').version")"
ALIGNED="$FRONTEND/android/app/build/outputs/apk/fork/app-fork-aligned.apk"
APK="$OUT_DIR/openGym-fork-$VERSION.apk"
mkdir -p "$OUT_DIR"

# Align first, sign second: a signature covers the aligned bytes, not the other way round.
"$ZIPALIGN" -f -p 4 "$UNSIGNED" "$ALIGNED"
# apksigner takes one password per line from a `file:` — the store one first, then the key one.
# A single-line pass file means both are the same, so it is doubled into a private temp copy
# (mktemp is 0600) rather than putting a password on a command line.
SIGN_PASS="$PASS_FILE"
if [ "$(wc -l < "$SIGN_PASS")" -lt 2 ]; then
  SIGN_PASS="$(mktemp)"
  trap 'rm -f "$SIGN_PASS"' EXIT
  awk '{ print; print }' "$PASS_FILE" > "$SIGN_PASS"
fi
"$APKSIGNER" sign --ks "$KEYSTORE" --ks-key-alias "$KEY_ALIAS" \
  --ks-pass "file:$SIGN_PASS" --key-pass "file:$SIGN_PASS" \
  --out "$APK" "$ALIGNED"
"$APKSIGNER" verify "$APK"
( cd "$OUT_DIR" && sha256sum "$(basename "$APK")" > "$(basename "$APK").sha256" )

echo "$APK"