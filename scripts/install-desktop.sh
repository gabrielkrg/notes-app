#!/usr/bin/env bash
# Build the Rust desktop app as an AppImage and replace the installed copy.
# Usage: scripts/install-desktop.sh [--run]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/rust-app"
BIN="$APP_DIR/node_modules/.bin"
TARGET="${NOTES_APPIMAGE:-$HOME/Applications/Notes-Rust.AppImage}"
BUNDLE_DIR="$APP_DIR/src-tauri/target/release/bundle/appimage"

cd "$APP_DIR"

# Always sync: new packages (e.g. fonts) must land even when node_modules exists.
# pnpm-lock.yaml is the lockfile here; npm isn't installed on this machine.
echo "==> Syncing dependencies"
pnpm install --prefer-offline

echo "==> Building UI"
"$BIN/tsc" --noEmit
"$BIN/vite" build

echo "==> Building AppImage"
GSTREAMER_HELPERS_DIR="$(pkg-config --variable=pluginscannerdir gstreamer-1.0 2>/dev/null || true)" \
  "$BIN/tauri" build --bundles appimage --config '{"build":{"beforeBuildCommand":""}}'

BUILT="$(ls -t "$BUNDLE_DIR"/*.AppImage | head -n1)"
echo "==> Installing $BUILT -> $TARGET"
mkdir -p "$(dirname "$TARGET")"
# Copy then rename, so a running instance doesn't block the update.
cp "$BUILT" "$TARGET.new"
chmod +x "$TARGET.new"
mv -f "$TARGET.new" "$TARGET"

if pgrep -f "$TARGET" >/dev/null; then
  echo "==> Notes is running; restart it to load the new version."
fi

if [[ "${1:-}" == "--run" ]]; then
  pkill -f "$TARGET" 2>/dev/null || true
  sleep 1
  setsid "$TARGET" >/dev/null 2>&1 &
  echo "==> Started $TARGET"
fi

echo "Done."
