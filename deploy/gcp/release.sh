#!/usr/bin/env bash
# Build the uploaded source on this server and switch the live app to it.
# Run as the deploy user (uses sudo for the privileged steps):
#
#   bash /tmp/release.sh
#
# Expects /tmp/arvo-src.tar.gz (deploy\gcp\deploy.ps1 uploads it).
# Builds on Linux (no cross-platform build artifacts), keeps the last three
# releases, and rolls back automatically if the new one fails its health check.
set -euo pipefail

SRC=/tmp/arvo-src.tar.gz
BUILD_DIR=/opt/arvo/build
RELEASE="/opt/arvo/releases/$(date -u +%Y%m%d-%H%M%S)"
PREVIOUS="$(readlink -f /opt/arvo/current 2>/dev/null || true)"

[ -f "$SRC" ] || { echo "Missing $SRC — upload the source first." >&2; exit 1; }

echo "== unpack"
sudo rm -rf "$BUILD_DIR"
sudo install -d -o "$(id -u)" -g "$(id -g)" "$BUILD_DIR"
tar -xzf "$SRC" -C "$BUILD_DIR"
rm -f "$SRC"
cd "$BUILD_DIR"

echo "== install dependencies"
export NEXT_TELEMETRY_DISABLED=1
npm ci --no-audit --no-fund --loglevel=error

echo "== build"
NODE_OPTIONS=--max-old-space-size=1536 npm run build

echo "== assemble $RELEASE"
sudo install -d -m 755 "$RELEASE" "$RELEASE/.next"
sudo cp -a .next/standalone/. "$RELEASE/"
# Standalone output doesn't include static assets or public/.
sudo cp -a .next/static "$RELEASE/.next/static"
if [ -d public ]; then sudo cp -a public "$RELEASE/public"; fi
# Releases are read-only to the app; persistent state lives outside them
# (linked in afterwards) so a deploy never overwrites it.
sudo rm -rf "$RELEASE/.agent.json" "$RELEASE/.next/cache"
sudo chown -R root:root "$RELEASE"
sudo ln -s /var/lib/arvo/agent.json "$RELEASE/.agent.json"
sudo ln -s /var/lib/arvo/next-cache "$RELEASE/.next/cache"

echo "== switch + restart"
sudo ln -sfn "$RELEASE" /opt/arvo/current
sudo systemctl restart arvo.service

healthy=false
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/loan || true)"
  if [ "$code" = "200" ]; then healthy=true; break; fi
  sleep 2
done

if [ "$healthy" != "true" ]; then
  echo "!! New release failed its health check. Recent logs:" >&2
  sudo journalctl -u arvo.service -n 40 --no-pager >&2 || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "!! Rolling back to $PREVIOUS" >&2
    sudo ln -sfn "$PREVIOUS" /opt/arvo/current
    sudo systemctl restart arvo.service
  fi
  exit 1
fi

echo "== prune old releases (keep 3)"
ls -1dt /opt/arvo/releases/* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf

echo "== release live: $RELEASE"
